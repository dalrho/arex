import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class TaskCreate(BaseModel):
    regulation_id: uuid.UUID
    remediation_draft_id: Optional[uuid.UUID] = None
    title: str
    description: str
    department: str
    priority: str = "Medium"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class TaskResponse(BaseModel):
    id: uuid.UUID
    regulation_id: uuid.UUID
    remediation_draft_id: Optional[uuid.UUID] = None
    title: str
    description: str
    department: str
    priority: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
