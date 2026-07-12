import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, computed_field

class ImpactResponse(BaseModel):
    id: uuid.UUID
    regulation_id: uuid.UUID
    organization_id: uuid.UUID
    risk_score: float
    impact_level: str
    rationale: str
    affected_departments: List[str]
    affected_documents: Optional[List[dict]] = None
    status: str
    created_at: datetime

    @computed_field
    @property
    def affected_documents_count(self) -> int:
        return len(self.affected_documents or [])

    @computed_field
    @property
    def provider(self) -> str:
        from app.core.config import settings
        return settings.active_provider

    @computed_field
    @property
    def model(self) -> str:
        from app.core.config import settings
        return settings.active_model_formatted

    class Config:
        from_attributes = True
