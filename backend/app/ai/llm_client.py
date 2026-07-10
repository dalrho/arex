import time
import logging
import json
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger("arex.llm-client")

T = TypeVar("T", bound=BaseModel)


class LLMClient:
    def __init__(self):
        self.settings = settings

    # ------------------------------------------------------------------
    # Mode detection
    # ------------------------------------------------------------------

    def is_offline_mode(self) -> bool:
        """
        Returns True when offline/mock mode is active.
        Offline mode is triggered by:
        - AI_MODE != "online"
        - OR no valid Gemini API key found
        """
        if not self.settings.is_online_mode:
            return True
        if not self.settings.effective_gemini_key:
            logger.warning(
                "AI_MODE=online but no Gemini API key found. Falling back to Offline Mode."
            )
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

        Online Mode  → Gemini API via google.genai SDK
        Offline Mode → deterministic mock responses (no LLM calls)

        Args:
            messages:       Chat messages (list of {role, content} dicts).
            response_model: Pydantic model for structured JSON output parsing.
            temperature:    Sampling temperature (0.0 = deterministic).
            max_tokens:     Maximum output tokens.
            context_docs:   Retrieved KB documents to inject as RAG grounding context.
        """
        mode_label = "OFFLINE (mock)" if self.is_offline_mode() else f"ONLINE (Gemini {self.settings.GEMINI_MODEL_NAME})"
        logger.info(
            f"[LLMClient] Mode={mode_label} | "
            f"StructuredOutput={response_model.__name__ if response_model else 'None'} | "
            f"ContextDocs={len(context_docs) if context_docs else 0}"
        )

        if self.is_offline_mode():
            logger.warning("[LLMClient] Offline mode active: returning deterministic mock response.")
            return self._generate_mock_response(messages, response_model)

        # Inject RAG context into the system prompt
        enriched_messages = self._inject_rag_context(messages, context_docs)

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
    # Gemini API call (google.genai SDK — new unified SDK)
    # ------------------------------------------------------------------

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
            from google import genai  # type: ignore
            from google.genai import types as genai_types  # type: ignore
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
                    f"Model: {self.settings.GEMINI_MODEL_NAME}"
                )

                # Build final contents list for this attempt
                call_contents = list(contents)
                call_contents.append(
                    genai_types.Content(role="user", parts=[genai_types.Part(text=current_user_prompt)])
                )

                response = client.models.generate_content(
                    model=self.settings.GEMINI_MODEL_NAME,
                    contents=call_contents,
                    config=generation_config,
                )

                latency = time.time() - start_time
                raw_text = response.text

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
                time.sleep(2 ** attempt)  # exponential backoff

    # ------------------------------------------------------------------
    # Offline mock responses (fully preserved)
    # ------------------------------------------------------------------

    def _generate_mock_response(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[T]],
    ) -> Any:
        """
        Generates high-fidelity mock responses for demoing AREX offline.
        Parses input prompts for keywords to produce realistic context-aware mocks.
        """
        combined_text = " ".join([m.get("content", "") for m in messages]).lower()

        if response_model is None:
            return "This is a mock text completion response for AREX."

        # 1. Regulatory Intelligence Output
        if response_model.__name__ == "RegulatoryIntelligenceOutput":
            is_relevant = any(kw in combined_text for kw in [
                "mfa", "multi-factor", "timeout", "session", "audit trail",
                "log", "signature", "electronic record",
            ])
            category = "other"
            if "signature" in combined_text:
                category = "signatures"
            elif "audit" in combined_text or "log" in combined_text:
                category = "records"
            elif "mfa" in combined_text or "timeout" in combined_text:
                category = "validation"

            urgency = "low"
            if "suspend" in combined_text or "warning" in combined_text or "penalty" in combined_text:
                urgency = "critical"
            elif "mfa" in combined_text or "timeout" in combined_text:
                urgency = "high"
            elif "signature" in combined_text:
                urgency = "medium"

            affected = []
            if "mfa" in combined_text or "timeout" in combined_text:
                affected.extend(["IT", "Engineering", "Quality Assurance"])
            if "signature" in combined_text or "record" in combined_text:
                affected.extend(["Quality Assurance", "Training"])
            if not affected:
                affected = ["Quality Assurance"]

            rationale = (
                "### Regulatory Classification Assessment\n"
                f"**Relevance Verdict:** {'Relevant' if is_relevant else 'Not Relevant'}\n\n"
                f"This amendment introduces specific constraints related to **{category}**. "
                "The requirements direct computer systems and access control modules to adhere to stricter guidelines. "
                "Specifically, password-only validation is deprecated in favor of stronger verification, "
                "which immediately impacts our system integration protocols and standard operating procedures."
            )

            return response_model(
                relevant=is_relevant,
                category=category,
                urgency=urgency,
                affected_business_areas=affected,
                rationale=rationale,
            )

        # 2. Remediation Draft Output
        elif "remediation" in response_model.__name__.lower() or "draft" in response_model.__name__.lower():
            if "sop-101" in combined_text or "access control" in combined_text or "timeout" in combined_text:
                original_text = (
                    "3.1 Password Complexity: User passwords must be a minimum of 8 characters, "
                    "containing at least one uppercase letter, one lowercase letter, one numeric digit, and one special character.\n"
                    "3.2 Session Timeout: Computer terminals and software applications must automatically log out a "
                    "user or lock the display terminal after 30 minutes of continuous keyboard or mouse inactivity."
                )
                proposed_text = (
                    "3.1 Password Complexity: User passwords must be a minimum of 8 characters, "
                    "containing at least one uppercase letter, one lowercase letter, one numeric digit, and one special character. "
                    "Additionally, Multi-Factor Authentication (MFA) must be enforced for all user accounts.\n"
                    "3.2 Session Timeout: Computer terminals and software applications must automatically log out a "
                    "user or lock the display terminal after 15 minutes of continuous keyboard or mouse inactivity."
                )
                citations = ["21 CFR Part 11.10(g)", "21 CFR Part 11.10(b)"]
                rationale = (
                    "Updates timeout limits to comply with the 15-minute mandate "
                    "and adds MFA enforcement requirements for GxP access."
                )
            else:
                original_text = "Standard Operating Procedure template placeholder text."
                proposed_text = (
                    "Standard Operating Procedure template placeholder text. "
                    "Revised in accordance with standard guidance rules."
                )
                citations = ["21 CFR Part 11.10"]
                rationale = "General alignment with quality standard requirements."

            fields = response_model.model_fields
            mock_dict: Dict[str, Any] = {}
            if "proposed_text" in fields:
                mock_dict["proposed_text"] = proposed_text
            if "original_text" in fields:
                mock_dict["original_text"] = original_text
            if "citations" in fields:
                mock_dict["citations"] = citations
            if "rationale" in fields:
                mock_dict["rationale"] = rationale
            for field_name in fields:
                if field_name not in mock_dict:
                    mock_dict[field_name] = [] if "list" in str(fields[field_name].annotation).lower() else ""

            return response_model.model_validate(mock_dict)

        # 3. Implementation Tasks Output
        else:
            tasks_list = [
                {
                    "title": "Enable Multi-Factor Authentication (MFA) for GxP Applications",
                    "description": "Configure SSO or local application settings to enforce MFA upon user login.",
                    "department": "IT",
                    "priority": "High",
                },
                {
                    "title": "Reduce Inactivity Session Timeout to 15 Minutes",
                    "description": "Update group policies and web-app session tokens to lock inactive sessions after 15 minutes.",
                    "department": "Engineering",
                    "priority": "Medium",
                },
                {
                    "title": "Train Staff on Revised SOP-101 Procedures",
                    "description": "Distribute revised Access Control SOP guidelines and collect training acknowledgements.",
                    "department": "Training",
                    "priority": "Low",
                },
            ]

            fields = response_model.model_fields
            for field_name, field in fields.items():
                if "list" in str(field.annotation).lower() or "sequence" in str(field.annotation).lower():
                    try:
                        inner_type = field.annotation.__args__[0]
                        inner_tasks = [inner_type.model_validate(t) for t in tasks_list]
                        return response_model.model_validate({field_name: inner_tasks})
                    except Exception:
                        pass

            try:
                return response_model.model_validate({"tasks": tasks_list})
            except Exception:
                return response_model.model_validate(tasks_list)


llm_client = LLMClient()
