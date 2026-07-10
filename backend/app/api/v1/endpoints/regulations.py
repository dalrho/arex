import logging
import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib

from app.core.dependencies import get_db, get_tenant_id
from app.models.regulation_update import RegulationUpdate
from app.api.v1.schemas.regulation import RegulationResponse
from app.ai.graph_builder import trigger_agent_pipeline
from app.core.audit import add_audit_event

logger = logging.getLogger("arex.api.regulations")

router = APIRouter()

def helper_map_regulation_response(reg: RegulationUpdate) -> RegulationResponse:
    """
    Helper function to parse classification from parsed_sections JSON
    and map it onto the RegulationResponse fields.
    """
    res = RegulationResponse.model_validate(reg)
    if isinstance(reg.parsed_sections, dict) and "classification" in reg.parsed_sections:
        clf = reg.parsed_sections["classification"]
        res.relevant = clf.get("relevant")
        res.category = clf.get("category")
        res.urgency = clf.get("urgency")
        res.affected_business_areas = clf.get("affected_business_areas")
        res.rationale = clf.get("rationale")
    return res

@router.get("/", response_model=List[RegulationResponse])
def list_regulations(
    db: Session = Depends(get_db)
) -> Any:
    """
    List all FDA regulations monitored by the platform.
    """
    regulations = db.query(RegulationUpdate).order_by(RegulationUpdate.published_date.desc()).all()
    return [helper_map_regulation_response(r) for r in regulations]

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
    return helper_map_regulation_response(regulation)

from app.workers.monitoring_job import run_monitoring_job

@router.post("/poll", response_model=dict, status_code=status.HTTP_200_OK)
def trigger_regulations_polling(
    limit: int = 10,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    On-demand trigger for polling and downloading FDA guidance updates from the Federal Register.
    """
    try:
        new_count = run_monitoring_job(limit=limit)
        return {"status": "success", "ingested_count": new_count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to poll FDA endpoints: {str(e)}"
        )

# We define a custom request body for manual ingestion
from pydantic import BaseModel as PydanticBaseModel
class IngestionRequest(PydanticBaseModel):
    title: str
    source_url: str
    raw_content: str

@router.post("/ingest", response_model=RegulationResponse, status_code=status.HTTP_201_CREATED)
def ingest_regulation(
    payload: IngestionRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
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
        status="Not Analyzed"
    )

    db.add(reg)
    db.commit()
    db.refresh(reg)

    add_audit_event(db, reg.id, "regulation_imported", f"FDA regulation '{reg.title}' manually ingested.")

    # Trigger the AI LangGraph pipeline synchronously
    try:
        final_state = trigger_agent_pipeline(
            regulation_id=str(reg.id),
            organization_id=tenant_id,
            raw_content=reg.raw_content
        )
        
        # Save results in the DB
        reg.status = "Not Analyzed"
        reg.parsed_sections = {
            "sections": parsed,
            "classification": {
                "relevant": final_state.get("relevant", False),
                "category": final_state.get("category", "other"),
                "urgency": final_state.get("urgency", "low"),
                "affected_business_areas": final_state.get("affected_business_areas", []),
                "rationale": final_state.get("rationale", "")
            }
        }
        db.add(reg)
        db.commit()
        db.refresh(reg)
        logger.info(f"Successfully processed LangGraph pipeline for ingested regulation: {reg.id}")
    except Exception as e:
        logger.error(f"Failed to run LangGraph pipeline during ingestion: {e}")
        # We don't roll back the ingestion, but log the failure so API doesn't crash on connection issues

    return helper_map_regulation_response(reg)


@router.patch("/{regulation_id}/status", response_model=RegulationResponse)
def update_regulation_status(
    regulation_id: uuid.UUID,
    status_payload: dict,
    db: Session = Depends(get_db)
) -> Any:
    regulation = db.query(RegulationUpdate).filter(RegulationUpdate.id == regulation_id).first()
    if not regulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regulation update not found"
        )
    new_status = status_payload.get("status")
    if new_status:
        regulation.status = new_status
        
        # Log case closing or status changes in audit log
        if new_status == "Closed":
            add_audit_event(db, regulation_id, "case_closed", "Compliance Case was closed successfully.")
        else:
            add_audit_event(db, regulation_id, "status_updated", f"Compliance Case status updated to '{new_status}'.")
            
        db.add(regulation)
        db.commit()
        db.refresh(regulation)
    return helper_map_regulation_response(regulation)

