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
    created_at: datetime

    class Config:
        from_attributes = True
