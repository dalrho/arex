import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, computed_field

class RegulationResponse(BaseModel):
    id: uuid.UUID
    source_url: str
    title: str
    published_date: datetime
    raw_content: str
    parsed_sections: Optional[Any] = None
    hash_value: str
    status: str
    audit_history: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    # Source tracking
    source: str = "FDA_API"
    document_number: Optional[str] = None
    effective_date: Optional[datetime] = None
    summary: Optional[str] = None
    regulatory_authority: Optional[str] = None
    category: Optional[str] = None

    # AI agent verdicts
    relevant: Optional[bool] = None
    urgency: Optional[str] = None
    affected_business_areas: Optional[List[str]] = None
    rationale: Optional[str] = None

    @computed_field
    @property
    def provider(self) -> str:
        return "Fireworks AI"

    @computed_field
    @property
    def model(self) -> str:
        from app.core.config import settings
        return settings.fireworks_model_formatted

    class Config:
        from_attributes = True


class RegulatoryIntelligenceOutput(BaseModel):
    relevant: bool
    category: str  # Enum: "records", "validation", "signatures", "other"
    urgency: str  # Enum: "low", "medium", "high", "critical"
    affected_business_areas: List[str]
    rationale: str  # Markdown text explaining decision
