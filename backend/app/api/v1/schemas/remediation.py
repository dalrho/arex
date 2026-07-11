import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, model_validator


class RemediationUpdateRequest(BaseModel):
    proposed_text: Optional[str] = None
    proposedRevision: Optional[str] = None
    diff_content: Optional[Any] = None
    comments: Optional[str] = None

class RemediationResponse(BaseModel):
    id: uuid.UUID
    sop_id: uuid.UUID
    regulation_id: uuid.UUID
    current_content: str
    proposed_revision: str
    diff_content: Optional[Any] = None
    explanation: Optional[str] = None
    requires_tasks: Optional[bool] = True
    status: str
    comments: Optional[str] = None
    reviewer_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Aliases
    sopId: Optional[uuid.UUID] = None
    currentContent: Optional[str] = None
    proposedRevision: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    # Legacy fields
    document_id: Optional[uuid.UUID] = None
    original_text: Optional[str] = None
    proposed_text: Optional[str] = None

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def populate_aliases(self) -> "RemediationResponse":
        if self.sopId is None:
            self.sopId = self.sop_id
        if self.currentContent is None:
            self.currentContent = self.current_content
        if self.proposedRevision is None:
            self.proposedRevision = self.proposed_revision
        if self.createdAt is None:
            self.createdAt = self.created_at
        if self.updatedAt is None:
            self.updatedAt = self.updated_at or self.created_at
            
        if self.document_id is None:
            self.document_id = self.sop_id
        if self.original_text is None:
            self.original_text = self.current_content
        if self.proposed_text is None:
            self.proposed_text = self.proposed_revision
        return self

