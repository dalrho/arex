import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class RegulationResponse(BaseModel):
    id: uuid.UUID
    source_url: str
    title: str
    published_date: datetime
    raw_content: str
    parsed_sections: Optional[Any] = None
    hash_value: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
