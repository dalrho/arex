import uuid
from datetime import datetime
from pydantic import BaseModel

class DocumentBase(BaseModel):
    filename: str

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    file_path: str
    version: int
    parsed_text: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentVersionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version: int
    filename: str
    file_path: str
    parsed_text: str | None
    reason_for_revision: str | None
    created_at: datetime

    class Config:
        from_attributes = True

