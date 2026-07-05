import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel

class ApprovalDecisionRequest(BaseModel):
    decision: str  # APPROVED | REJECTED | EDITED
    final_content: Optional[Any] = None

class ApprovalRecordResponse(BaseModel):
    id: uuid.UUID
    item_type: str
    item_id: uuid.UUID
    status: str
    reviewer_id: uuid.UUID
    timestamp: datetime
    original_content: Optional[Any] = None
    final_content: Optional[Any] = None

    class Config:
        from_attributes = True
