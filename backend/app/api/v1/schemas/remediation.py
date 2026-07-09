import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel

class RemediationUpdateRequest(BaseModel):
    proposed_text: str
    diff_content: Optional[Any] = None

class RemediationResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    regulation_id: uuid.UUID
    proposed_text: str
    original_text: str
    diff_content: Optional[Any] = None
    explanation: Optional[str] = None
    requires_tasks: Optional[bool] = True
    status: str
    reviewer_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime



    class Config:
        from_attributes = True
