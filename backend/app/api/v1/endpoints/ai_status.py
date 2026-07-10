"""
AI Status Endpoint
Exposes the current AI mode (online | offline) and relevant metadata
so the frontend can display a live status indicator.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.ai.llm_client import llm_client
from app.services.embeddings.embedding_service import embedding_service

router = APIRouter()


class AIStatusResponse(BaseModel):
    mode: str                         # "online" | "offline"
    model: Optional[str] = None       # Active LLM model name (online only)
    embedding_model: Optional[str] = None
    gemini_key_configured: bool
    reason: Optional[str] = None      # Why offline, if applicable


@router.get("/", response_model=AIStatusResponse, tags=["AI Status"])
def get_ai_status():
    """
    Returns the current AI operating mode and configuration details.

    - **online**: Gemini API is active; RAG and real inference are enabled.
    - **offline**: Mock responses only; no LLM calls are made.
    """
    is_offline = llm_client.is_offline_mode()
    gemini_key_present = bool(settings.effective_gemini_key)

    if is_offline:
        if not settings.is_online_mode:
            reason = "AI_MODE is set to 'offline'."
        elif not gemini_key_present:
            reason = "AI_MODE=online but no Gemini API key is configured."
        else:
            reason = "Offline mode active."

        return AIStatusResponse(
            mode="offline",
            model=None,
            embedding_model=None,
            gemini_key_configured=gemini_key_present,
            reason=reason,
        )

    return AIStatusResponse(
        mode="online",
        model=settings.GEMINI_MODEL_NAME,
        embedding_model=settings.GEMINI_EMBEDDING_MODEL,
        gemini_key_configured=True,
        reason=None,
    )
