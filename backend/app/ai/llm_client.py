import time
import logging
import json
from typing import Any, Dict, List, Optional, Type, TypeVar
import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger("sentinel-os.llm-client")

T = TypeVar("T", bound=BaseModel)

class LLMClient:
    def __init__(self):
        self.api_key = settings.LLM_API_KEY
        self.api_base = settings.LLM_API_BASE
        self.model_name = settings.LLM_MODEL_NAME

    def is_offline_mode(self) -> bool:
        """
        Determines if the LLM client should run in offline mock mode.
        """
        return (
            not self.api_key
            or self.api_key.strip() == ""
            or "your_llm_provider" in self.api_key
        )

    def get_completion(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[T]] = None,
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> Any:
        """
        Sends a chat completion request to the LLM.
        Supports structured JSON parsing with Pydantic and retry logic.
        Falls back to deterministic offline mocks if no API key is configured.
        """
        if self.is_offline_mode():
            logger.warning("Offline mode active: Generating deterministic mock LLM response.")
            return self._generate_mock_response(messages, response_model)

        # Call real API with structured parsing & retry logic
        return self._call_api_with_retry(
            messages=messages,
            response_model=response_model,
            temperature=temperature,
            max_tokens=max_tokens,
            attempts=3
        )

    def _call_api_with_retry(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[T]],
        temperature: float,
        max_tokens: int,
        attempts: int = 3,
    ) -> Any:
        current_messages = list(messages)
        
        for attempt in range(1, attempts + 1):
            start_time = time.time()
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": self.model_name,
                    "messages": current_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                
                # If a response model is requested, try to guide the model to output JSON
                if response_model:
                    payload["response_format"] = {"type": "json_object"}
                    # Ensure system prompt mentions JSON format
                    if not any("json" in msg.get("content", "").lower() for msg in current_messages):
                        current_messages.insert(0, {
                            "role": "system",
                            "content": "You are a system that MUST return valid JSON compliant with the requested schema."
                        })

                url = f"{self.api_base.rstrip('/')}/chat/completions"
                response = httpx.post(url, json=payload, headers=headers, timeout=60.0)
                response.raise_for_status()
                
                data = response.json()
                latency = time.time() - start_time
                
                usage = data.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens", 0)
                completion_tokens = usage.get("completion_tokens", 0)
                total_tokens = usage.get("total_tokens", 0)
                
                # Cost estimation for Qwen 72B (approx $0.90 per million tokens input/output)
                input_cost = (prompt_tokens / 1_000_000) * 0.90
                output_cost = (completion_tokens / 1_000_000) * 0.90
                estimated_cost = input_cost + output_cost

                content = data["choices"][0]["message"]["content"]
                
                logger.info(
                    f"LLM Call Succeeded | Model: {self.model_name} | Latency: {latency:.2f}s | "
                    f"Tokens: {total_tokens} (P: {prompt_tokens}, C: {completion_tokens}) | "
                    f"Estimated Cost: ${estimated_cost:.6f}"
                )

                if response_model:
                    try:
                        # Clean potential markdown wrappers if returned
                        cleaned_content = content.strip()
                        if cleaned_content.startswith("```json"):
                            cleaned_content = cleaned_content[7:]
                        if cleaned_content.endswith("```"):
                            cleaned_content = cleaned_content[:-3]
                        cleaned_content = cleaned_content.strip()
                        
                        parsed_json = json.loads(cleaned_content)
                        return response_model.model_validate(parsed_json)
                    except (json.JSONDecodeError, ValidationError) as parse_error:
                        logger.warning(
                            f"Structured output parsing failed on attempt {attempt}: {parse_error}. "
                            f"Response content: {content}"
                        )
                        if attempt == attempts:
                            raise parse_error
                        
                        # Add feedback message for retry
                        current_messages.append({"role": "assistant", "content": content})
                        current_messages.append({
                            "role": "user",
                            "content": f"The response was invalid: {str(parse_error)}. Please regenerate the JSON correctly."
                        })
                else:
                    return content
                    
            except Exception as e:
                logger.error(f"Error on LLM Call attempt {attempt}: {e}")
                if attempt == attempts:
                    raise e
                time.sleep(1)

    def _generate_mock_response(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[T]]
    ) -> Any:
        """
        Generates high-fidelity mock responses for demoing Sentinel OS offline.
        It parses the input prompts to match keywords and context.
        """
        # Find user input or regulation content in messages
        combined_text = " ".join([m.get("content", "") for m in messages]).lower()
        
        if response_model is None:
            return "This is a mock text completion response for Sentinel OS."

        # 1. Regulatory Intelligence Output
        if response_model.__name__ == "RegulatoryIntelligenceOutput":
            # Check keywords to determine relevance & category
            is_relevant = any(kw in combined_text for kw in ["mfa", "multi-factor", "timeout", "session", "audit trail", "log", "signature", "electronic record"])
            
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

            # Ensure we return the correct Pydantic structure
            return response_model(
                relevant=is_relevant,
                category=category,
                urgency=urgency,
                affected_business_areas=affected,
                rationale=rationale
            )

        # 2. Remediation Draft Output
        elif "remediation" in response_model.__name__.lower() or "draft" in response_model.__name__.lower():
            # Check if it targets SOP-101 (Access Control / timeouts)
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
                rationale = "Updates timeout limits to comply with the 15-minute mandate and adds MFA enforcement requirements for GxP access."
            else:
                original_text = "Standard Operating Procedure template placeholder text."
                proposed_text = "Standard Operating Procedure template placeholder text. Revised in accordance with standard guidance rules."
                citations = ["21 CFR Part 11.10"]
                rationale = "General alignment with quality standard requirements."

            # Construct mock output (can return dict or validate model based on model fields)
            fields = response_model.__fields__
            mock_dict = {}
            if "proposed_text" in fields:
                mock_dict["proposed_text"] = proposed_text
            if "original_text" in fields:
                mock_dict["original_text"] = original_text
            if "citations" in fields:
                mock_dict["citations"] = citations
            if "rationale" in fields:
                mock_dict["rationale"] = rationale
            
            # Additional fallback values if specific fields are expected
            for field_name in fields:
                if field_name not in mock_dict:
                    mock_dict[field_name] = [] if fields[field_name].annotation == list else ""

            return response_model.model_validate(mock_dict)

        # 3. Implementation Tasks Output
        else:
            # We assume it's requesting tasks
            tasks_list = [
                {
                    "title": "Enable Multi-Factor Authentication (MFA) for GxP Applications",
                    "description": "Configure single sign-on (SSO) or local application settings to enforce multi-factor validation upon user login.",
                    "department": "IT",
                    "priority": "High"
                },
                {
                    "title": "Reduce Inactivity Session Timeout Limit to 15 Minutes",
                    "description": "Update terminal group policies and web-app configuration tokens to lock inactive sessions after 15 minutes.",
                    "department": "Engineering",
                    "priority": "Medium"
                },
                {
                    "title": "Conduct Staff Training on New MFA & Timeout SOP-101 Procedures",
                    "description": "Distribute revised Access Control SOP guidelines to all personnel and collect training logs.",
                    "department": "Training",
                    "priority": "Low"
                }
            ]
            
            # Find if model has a tasks or list of items attribute
            fields = response_model.__fields__
            # If the response model is a list-based container
            for field_name, field in fields.items():
                if "list" in str(field.annotation).lower() or "sequence" in str(field.annotation).lower():
                    # We try to validate tasks list inside this field
                    # Inspect inner type
                    try:
                        inner_type = field.annotation.__args__[0]
                        inner_tasks = [inner_type.model_validate(t) for t in tasks_list]
                        return response_model.model_validate({field_name: inner_tasks})
                    except Exception:
                        pass
            
            # Simple fallback
            try:
                return response_model.model_validate({"tasks": tasks_list})
            except Exception:
                return response_model.model_validate(tasks_list)

llm_client = LLMClient()
