import time
import logging
import json
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.core.exceptions import LLMConfigurationError

logger = logging.getLogger("arex.llm-client")

T = TypeVar("T", bound=BaseModel)


class LLMClient:
    def __init__(self):
        self.settings = settings
        # Log active configuration on initialization to console
        print("\n" + "="*60, flush=True)
        print("🤖 Sentinel OS AI Orchestrator Initialized", flush=True)
        print(f"👉 AI Mode  : {self.settings.AI_MODE.upper()}", flush=True)
        print(f"👉 Provider : {self.settings.active_provider}", flush=True)
        print(f"👉 Model    : {self.settings.active_model_formatted}", flush=True)
        print("="*60 + "\n", flush=True)

    # ------------------------------------------------------------------
    # Mode detection
    # ------------------------------------------------------------------

    def is_offline_mode(self) -> bool:
        """
        Returns True when offline/mock mode is active.
        Offline mode is triggered by:
        - AI_MODE not in ("online", "developer", "hackathon")
        - OR (AI_MODE == developer and no valid Gemini API key found)
        - OR (AI_MODE == hackathon and no valid Fireworks API key found)
        """
        mode = self.settings.AI_MODE.strip().lower()
        if not self.settings.is_online_mode:
            return True
        if mode == "developer":
            if not self.settings.effective_gemini_key:
                logger.warning("AI_MODE=developer but no Gemini API key found. Falling back to Offline Mode.")
                return True
        elif mode == "hackathon":
            if not self.settings.FIREWORKS_API_KEY or not self.settings.FIREWORKS_API_KEY.strip():
                logger.warning("AI_MODE=hackathon but no Fireworks API key found. Falling back to Offline Mode.")
                return True
        else:
            # Legacy online mode fallback
            if not self.settings.effective_gemini_key and not self.settings.FIREWORKS_API_KEY:
                return True
        return False

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def get_completion(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[T]] = None,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        context_docs: Optional[List[Dict]] = None,
    ) -> Any:
        """
        Sends a chat completion request to the LLM.

        Developer Mode → Google Gemini API via google-genai SDK
        Hackathon Mode → Fireworks AI API via fireworks-ai SDK
        Offline Mode   → deterministic mock responses (no LLM calls)

        Args:
            messages:       Chat messages (list of {role, content} dicts).
            response_model: Pydantic model for structured JSON output parsing.
            temperature:    Sampling temperature (0.0 = deterministic).
            max_tokens:     Maximum output tokens.
            context_docs:   Retrieved KB documents to inject as RAG grounding context.
        """
        mode = self.settings.AI_MODE.strip().lower()
        if self.is_offline_mode():
            mode_label = "OFFLINE (mock)"
        elif mode == "hackathon":
            mode_label = f"ONLINE (Fireworks {self.settings.FIREWORKS_MODEL})"
        else:
            mode_label = f"ONLINE (Gemini {self.settings.GEMINI_MODEL})"

        logger.info(
            f"[LLMClient] Request routing | AI Mode: {self.settings.AI_MODE.upper()} | "
            f"Provider: {self.settings.active_provider} | "
            f"Model: {self.settings.active_model_formatted}"
        )
        logger.info(
            f"[LLMClient] Mode={mode_label} | "
            f"StructuredOutput={response_model.__name__ if response_model else 'None'} | "
            f"ContextDocs={len(context_docs) if context_docs else 0}"
        )

        if self.is_offline_mode():
            logger.warning("[LLMClient] Offline mode active: raising LLMConfigurationError.")
            raise LLMConfigurationError("No LLM provider configured. Configure an API key to use AI features.")

        # Inject RAG context into the system prompt
        enriched_messages = self._inject_rag_context(messages, context_docs)

        if mode == "hackathon":
            return self._call_fireworks(
                messages=enriched_messages,
                response_model=response_model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        else:
            return self._call_gemini(
                messages=enriched_messages,
                response_model=response_model,
                temperature=temperature,
                max_tokens=max_tokens,
            )

    # ------------------------------------------------------------------
    # RAG context injection
    # ------------------------------------------------------------------

    def _inject_rag_context(
        self,
        messages: List[Dict[str, str]],
        context_docs: Optional[List[Dict]],
    ) -> List[Dict[str, str]]:
        """Prepend retrieved document context into the system message for RAG grounding."""
        if not context_docs:
            return messages

        context_parts = []
        for i, doc in enumerate(context_docs, start=1):
            doc_name = doc.get("document_name", f"Document {i}")
            snippet = doc.get("text_snippet", doc.get("affected_sections", ""))
            score = doc.get("confidence_score", doc.get("score", 0))
            context_parts.append(f"[{i}] {doc_name} (relevance: {score:.1f}%):\n{snippet}")

        context_block = (
            "## Retrieved Knowledge Base Context\n"
            "The following internal QMS documents are retrieved and relevant to this request:\n\n"
            + "\n\n".join(context_parts)
            + "\n\n---\nGround your response in the above context. "
            "Do not fabricate citations or references not present in the retrieved documents."
        )

        logger.info(
            f"[LLMClient] RAG: injecting {len(context_docs)} retrieved document chunk(s) into prompt."
        )

        enriched = list(messages)
        for i, msg in enumerate(enriched):
            if msg.get("role") == "system":
                enriched[i] = {
                    "role": "system",
                    "content": msg["content"] + "\n\n" + context_block,
                }
                return enriched

        # No system message — prepend one
        enriched.insert(0, {"role": "system", "content": context_block})
        return enriched

    # ------------------------------------------------------------------
    # Fireworks AI API call (fireworks-ai SDK)
    # ------------------------------------------------------------------

    def _call_fireworks(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[T]],
        temperature: float,
        max_tokens: int,
        attempts: int = 3,
    ) -> Any:
        """
        Calls Fireworks AI via the official fireworks SDK.
        Supports structured JSON output with retry logic.
        """
        try:
            from fireworks import Fireworks
        except ImportError as exc:
            raise RuntimeError(
                "fireworks-ai package is not installed. Run: pip install fireworks-ai"
            ) from exc

        client = Fireworks(api_key=self.settings.FIREWORKS_API_KEY)

        # Find system message or prepare to prepend
        system_msg_idx = -1
        for i, msg in enumerate(messages):
            if msg.get("role") == "system":
                system_msg_idx = i
                break

        # Standard OpenAI/Fireworks chat completion parameters
        extra_args = {}
        if response_model:
            # Tell fireworks we want JSON format
            extra_args["response_format"] = {"type": "json_object"}
            
            schema_hint = json.dumps(
                {k: str(v.annotation) for k, v in response_model.model_fields.items()},
                indent=2,
            )
            json_instruction = (
                f"\n\nYou MUST respond with a SINGLE valid JSON object matching this schema "
                f"(no markdown code fences, no extra text outside the JSON):\n{schema_hint}"
            )
            if system_msg_idx != -1:
                # Update existing system prompt
                current_messages = list(messages)
                current_messages[system_msg_idx] = {
                    "role": "system",
                    "content": messages[system_msg_idx]["content"] + json_instruction
                }
            else:
                # Prepend system prompt
                current_messages = [{"role": "system", "content": "You are a helpful compliance assistant." + json_instruction}] + list(messages)
        else:
            current_messages = list(messages)

        model_name = self.settings.FIREWORKS_MODEL

        for attempt in range(1, attempts + 1):
            start_time = time.time()
            try:
                logger.info(
                    f"[LLMClient] Fireworks API call attempt {attempt}/{attempts} | "
                    f"Model: {model_name}"
                )

                logger.info(
                    f"[DEBUG LOG] Context sent to LLM:\n"
                    f"--- MESSAGES ---\n{json.dumps(current_messages, indent=2)}\n"
                    f"--------------------------"
                )

                response = client.chat.completions.create(
                    model=model_name,
                    messages=current_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **extra_args
                )

                latency = time.time() - start_time
                raw_text = response.choices[0].message.content

                logger.info(
                    f"[DEBUG LOG] Raw LLM response:\n"
                    f"{raw_text}\n"
                    f"--------------------------"
                )

                # Extract token usage if available
                usage = getattr(response, "usage", None)
                prompt_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
                completion_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
                total_tokens = getattr(usage, "total_tokens", prompt_tokens + completion_tokens) if usage else 0

                logger.info(
                    f"[LLMClient] Fireworks call succeeded | "
                    f"Latency: {latency:.2f}s | "
                    f"Tokens: {total_tokens} (prompt={prompt_tokens}, completion={completion_tokens})"
                )

                if response_model:
                    try:
                        # Strip markdown code fences if model added them
                        cleaned = raw_text.strip()
                        if cleaned.startswith("```json"):
                            cleaned = cleaned[7:]
                        if cleaned.startswith("```"):
                            cleaned = cleaned[3:]
                        if cleaned.endswith("```"):
                            cleaned = cleaned[:-3]
                        cleaned = cleaned.strip()

                        parsed_json = json.loads(cleaned)
                        validated = response_model.model_validate(parsed_json)
                        logger.info(
                            f"[LLMClient] Structured output validated as {response_model.__name__}."
                        )
                        return validated
                    except (json.JSONDecodeError, ValidationError) as parse_error:
                        logger.warning(
                            f"[LLMClient] Structured parsing failed on attempt {attempt}: "
                            f"{parse_error}. Raw: {raw_text[:400]}"
                        )
                        if attempt == attempts:
                            raise parse_error
                        # Feed correction back as next prompt
                        current_messages.append({"role": "assistant", "content": raw_text})
                        current_messages.append({
                            "role": "user",
                            "content": f"Your previous response was invalid JSON: {str(parse_error)}. "
                                       "Please output ONLY a valid JSON object matching the required schema."
                        })
                else:
                    return raw_text

            except Exception as e:
                logger.error(f"[LLMClient] Fireworks error on attempt {attempt}: {e}")
                if attempt == attempts:
                    raise e
                err_msg = str(e).lower()
                if "429" in err_msg or "resource_exhausted" in err_msg or "rate" in err_msg or "quota" in err_msg:
                    sleep_time = 15 * attempt
                    logger.warning(f"[LLMClient] Rate limit detected. Backing off for {sleep_time}s...")
                else:
                    sleep_time = 2 ** attempt
                time.sleep(sleep_time)  # backoff sleep

    def _call_gemini(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[T]],
        temperature: float,
        max_tokens: int,
        attempts: int = 3,
    ) -> Any:
        """
        Calls Google Gemini via the google.genai SDK.
        Supports structured JSON output with retry logic.
        """
        try:
            from google import genai
            from google.genai import types as genai_types
        except ImportError as exc:
            raise RuntimeError(
                "google-genai package is not installed. Run: pip install google-genai"
            ) from exc

        client = genai.Client(api_key=self.settings.effective_gemini_key)

        # Split messages into system instruction and conversation history
        system_instruction = None
        contents = []
        user_prompt = ""

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_instruction = content
            elif role == "assistant":
                contents.append(
                    genai_types.Content(role="model", parts=[genai_types.Part(text=content)])
                )
            else:
                user_prompt = content  # last user message

        # Append JSON schema instruction if structured output is needed
        if response_model:
            schema_hint = json.dumps(
                {k: str(v.annotation) for k, v in response_model.model_fields.items()},
                indent=2,
                default=str
            )
            json_instruction = (
                f"\n\nYou MUST respond with a SINGLE valid JSON object matching this schema "
                f"(no markdown code fences, no extra text outside the JSON):\n{schema_hint}"
            )
            system_instruction = (system_instruction or "You are a helpful compliance assistant.") + json_instruction

        generation_config = genai_types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            system_instruction=system_instruction,
        )

        current_user_prompt = user_prompt
        for attempt in range(1, attempts + 1):
            start_time = time.time()
            try:
                logger.info(
                    f"[LLMClient] Gemini API call attempt {attempt}/{attempts} | "
                    f"Model: {self.settings.GEMINI_MODEL}"
                )

                # Build final contents list for this attempt
                call_contents = list(contents)
                call_contents.append(
                    genai_types.Content(role="user", parts=[genai_types.Part(text=current_user_prompt)])
                )

                logger.info(
                    f"[DEBUG LOG] Context sent to LLM:\n"
                    f"--- SYSTEM INSTRUCTION ---\n{system_instruction}\n"
                    f"--- USER PROMPT ---\n{current_user_prompt}\n"
                    f"--------------------------"
                )

                response = client.models.generate_content(
                    model=self.settings.GEMINI_MODEL,
                    contents=call_contents,
                    config=generation_config,
                )

                latency = time.time() - start_time
                raw_text = response.text

                logger.info(
                    f"[DEBUG LOG] Raw LLM response:\n"
                    f"{raw_text}\n"
                    f"--------------------------"
                )

                # Extract token usage if available
                usage = getattr(response, "usage_metadata", None)
                prompt_tokens = getattr(usage, "prompt_token_count", 0) if usage else 0
                completion_tokens = getattr(usage, "candidates_token_count", 0) if usage else 0
                total_tokens = getattr(usage, "total_token_count", prompt_tokens + completion_tokens) if usage else 0

                logger.info(
                    f"[LLMClient] Gemini call succeeded | "
                    f"Latency: {latency:.2f}s | "
                    f"Tokens: {total_tokens} (prompt={prompt_tokens}, completion={completion_tokens})"
                )

                if response_model:
                    try:
                        # Strip markdown code fences if model added them
                        cleaned = raw_text.strip()
                        if cleaned.startswith("```json"):
                            cleaned = cleaned[7:]
                        if cleaned.startswith("```"):
                            cleaned = cleaned[3:]
                        if cleaned.endswith("```"):
                            cleaned = cleaned[:-3]
                        cleaned = cleaned.strip()

                        parsed_json = json.loads(cleaned)
                        validated = response_model.model_validate(parsed_json)
                        logger.info(
                            f"[LLMClient] Structured output validated as {response_model.__name__}."
                        )
                        return validated
                    except (json.JSONDecodeError, ValidationError) as parse_error:
                        logger.warning(
                            f"[LLMClient] Structured parsing failed on attempt {attempt}: "
                            f"{parse_error}. Raw: {raw_text[:400]}"
                        )
                        if attempt == attempts:
                            raise parse_error
                        # Feed correction back as next prompt
                        contents.append(
                            genai_types.Content(role="model", parts=[genai_types.Part(text=raw_text)])
                        )
                        current_user_prompt = (
                            f"Your previous response was invalid JSON: {str(parse_error)}. "
                            "Please output ONLY a valid JSON object matching the required schema."
                        )
                else:
                    return raw_text

            except Exception as e:
                logger.error(f"[LLMClient] Gemini error on attempt {attempt}: {e}")
                if attempt == attempts:
                    raise e
                err_msg = str(e).lower()
                if "429" in err_msg or "resource_exhausted" in err_msg or "rate" in err_msg or "quota" in err_msg:
                    sleep_time = 15 * attempt
                    logger.warning(f"[LLMClient] Rate limit detected. Backing off for {sleep_time}s...")
                else:
                    sleep_time = 2 ** attempt
                time.sleep(sleep_time)  # backoff sleep


llm_client = LLMClient()
