"""
AI Status Endpoint
Exposes the current AI mode, provider metadata, and cumulative token usage
so the frontend can display a live inference status indicator.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.core.token_usage import token_usage_tracker
from app.ai.llm_client import llm_client

router = APIRouter()


class AIStatusResponse(BaseModel):
    mode: str  # "online" | "offline" | "hackathon"
    provider: str
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    inference_label: str
    cumulative_tokens: int
    prompt_tokens: int
    completion_tokens: int
    gemini_key_configured: bool
    fireworks_key_configured: bool
    reason: Optional[str] = None


def _build_inference_label(mode: str, model: Optional[str], is_offline: bool) -> str:
    if is_offline:
        return "Offline · Mock"
    if mode == "hackathon":
        model_name = model or settings.fireworks_model_formatted or "Fireworks"
        return f"Inference: Fireworks on AMD Instinct — {model_name}"
    if mode == "developer":
        model_name = model or settings.GEMINI_MODEL_NAME or "Gemini"
        return f"Online AI · {model_name}"
    # legacy "online" alias
    model_name = model or settings.active_model_formatted or "LLM"
    return f"Online AI · {model_name}"


@router.get("/", response_model=AIStatusResponse, tags=["AI Status"])
def get_ai_status():
    """
    Returns the current AI operating mode, provider label, and cumulative tokens.

    - **hackathon**: Fireworks AI on AMD Instinct; RAG and real inference enabled.
    - **developer** / **online**: Gemini API is active.
    - **offline**: Mock responses only; no LLM calls are made.
    """
    configured_mode = settings.AI_MODE.strip().lower()
    is_offline = llm_client.is_offline_mode()
    gemini_key_present = bool(settings.effective_gemini_key)
    fireworks_key_present = bool(
        settings.FIREWORKS_API_KEY and settings.FIREWORKS_API_KEY.strip()
    )
    usage = token_usage_tracker.snapshot()

    if is_offline:
        if not settings.is_online_mode:
            reason = "AI_MODE is set to 'offline'."
        elif configured_mode == "hackathon" and not fireworks_key_present:
            reason = "AI_MODE=hackathon but no Fireworks API key is configured."
        elif configured_mode in ("online", "developer") and not gemini_key_present:
            reason = "AI_MODE requires a Gemini API key but none is configured."
        else:
            reason = "Offline mode active."

        return AIStatusResponse(
            mode="offline",
            provider=settings.active_provider,
            model=None,
            embedding_model=None,
            inference_label=_build_inference_label("offline", None, True),
            cumulative_tokens=usage["total_tokens"],
            prompt_tokens=usage["prompt_tokens"],
            completion_tokens=usage["completion_tokens"],
            gemini_key_configured=gemini_key_present,
            fireworks_key_configured=fireworks_key_present,
            reason=reason,
        )

    # Active online / hackathon / developer routing
    response_mode = configured_mode if configured_mode in ("hackathon", "developer") else "online"
    model = settings.active_model_formatted
    embedding_model = None
    if response_mode == "hackathon":
        embedding_model = settings.FIREWORKS_EMBEDDING_MODEL
    else:
        embedding_model = settings.GEMINI_EMBEDDING_MODEL

    return AIStatusResponse(
        mode=response_mode,
        provider=settings.active_provider,
        model=model,
        embedding_model=embedding_model,
        inference_label=_build_inference_label(response_mode, model, False),
        cumulative_tokens=usage["total_tokens"],
        prompt_tokens=usage["prompt_tokens"],
        completion_tokens=usage["completion_tokens"],
        gemini_key_configured=gemini_key_present,
        fireworks_key_configured=fireworks_key_present,
        reason=None,
    )
