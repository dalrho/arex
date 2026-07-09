import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

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


    class Config:
        from_attributes = True
