import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib

from app.core.dependencies import get_db
from app.models.regulation_update import RegulationUpdate
from app.api.v1.schemas.regulation import RegulationResponse

router = APIRouter()

@router.get("/", response_model=List[RegulationResponse])
def list_regulations(
    db: Session = Depends(get_db)
) -> Any:
    """
    List all FDA regulations monitored by the platform.
    """
    regulations = db.query(RegulationUpdate).order_by(RegulationUpdate.published_date.desc()).all()
    return regulations

@router.get("/{regulation_id}", response_model=RegulationResponse)
def get_regulation(
    regulation_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific regulation update details.
    """
    regulation = db.query(RegulationUpdate).filter(RegulationUpdate.id == regulation_id).first()
    if not regulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regulation update not found"
        )
    return regulation

# We define a custom request body for manual ingestion
from pydantic import BaseModel as PydanticBaseModel
class IngestionRequest(PydanticBaseModel):
    title: str
    source_url: str
    raw_content: str

@router.post("/ingest", response_model=RegulationResponse, status_code=status.HTTP_201_CREATED)
def ingest_regulation(
    payload: IngestionRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Manually ingest a new regulation text for analysis and impact mapping.
    """
    # Check if a regulation with this hash already exists
    hash_val = hashlib.sha256(payload.raw_content.encode("utf-8")).hexdigest()
    existing = db.query(RegulationUpdate).filter(RegulationUpdate.hash_value == hash_val).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A regulation with identical content hash has already been ingested."
        )

    # Simple mock parsed sections splitter
    parsed = {}
    lines = [line.strip() for line in payload.raw_content.split(".") if len(line.strip()) > 10]
    for idx, line in enumerate(lines[:3]):
        parsed[f"section_1.{idx+1}"] = line + "."

    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=payload.source_url,
        title=payload.title,
        published_date=datetime.now(timezone.utc),
        raw_content=payload.raw_content,
        parsed_sections=parsed,
        hash_value=hash_val,
        status="pending_analysis"
    )

    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg
