import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, computed_field

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
    jira_issue_key: Optional[str] = None

    @computed_field
    @property
    def jira_issue_url(self) -> Optional[str]:
        from app.core.config import settings
        if self.jira_issue_key and settings.JIRA_URL:
            return f"{settings.JIRA_URL.rstrip('/')}/browse/{self.jira_issue_key}"
        return None

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
