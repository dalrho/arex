import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional
import hashlib

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_tenant_id
from app.models.regulation_update import (
    RegulationUpdate,
    REGULATION_SOURCE_FDA_API,
    REGULATION_SOURCE_DOCUMENT_UPLOAD,
)
from app.api.v1.schemas.regulation import RegulationResponse
from app.ai.graph_builder import trigger_agent_pipeline
from app.core.audit import add_audit_event

logger = logging.getLogger("arex.api.regulations")

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def helper_map_regulation_response(reg: RegulationUpdate) -> RegulationResponse:
    """
    Maps the RegulationUpdate ORM model onto the RegulationResponse schema,
    pulling AI classification data out of the parsed_sections JSON blob.
    """
    res = RegulationResponse.model_validate(reg)
    if isinstance(reg.parsed_sections, dict) and "classification" in reg.parsed_sections:
        clf = reg.parsed_sections["classification"]
        res.relevant = clf.get("relevant")
        # Prefer dedicated model column over JSON blob; fall back to JSON blob
        if not res.category:
            res.category = clf.get("category")
        res.urgency = clf.get("urgency")
        res.affected_business_areas = clf.get("affected_business_areas")
        res.rationale = clf.get("rationale")
    return res


def _chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk_words = words[i : i + chunk_size]
        chunks.append(" ".join(chunk_words))
        if i + chunk_size >= len(words):
            break
        i += chunk_size - overlap
    return chunks


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[RegulationResponse])
def list_regulations(db: Session = Depends(get_db)) -> Any:
    """
    List all regulations in the platform, ordered by most recently published.
    Returns an empty list when the database is empty — no demo data injected.
    """
    regulations = (
        db.query(RegulationUpdate)
        .order_by(RegulationUpdate.published_date.desc())
        .all()
    )
    return [helper_map_regulation_response(r) for r in regulations]


@router.get("/{regulation_id}", response_model=RegulationResponse)
def get_regulation(
    regulation_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> Any:
    """Get a specific regulation by ID."""
    regulation = (
        db.query(RegulationUpdate)
        .filter(RegulationUpdate.id == regulation_id)
        .first()
    )
    if not regulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regulation not found",
        )
    return helper_map_regulation_response(regulation)


# ---------------------------------------------------------------------------
# FDA API fetch / poll
# ---------------------------------------------------------------------------

from app.workers.monitoring_job import run_monitoring_job


@router.post("/poll", response_model=dict, status_code=status.HTTP_200_OK)
def trigger_regulations_polling(
    limit: int = 10,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> Any:
    """
    On-demand trigger for polling and downloading FDA guidance updates from the
    Federal Register API.  New records are tagged with source=FDA_API.
    """
    try:
        new_count = run_monitoring_job(limit=limit)
        return {"status": "success", "ingested_count": new_count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to poll FDA endpoints: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Manual text ingestion (legacy / internal use)
# ---------------------------------------------------------------------------

class IngestionRequest(PydanticBaseModel):
    title: str
    source_url: str
    raw_content: str


@router.post("/ingest", response_model=RegulationResponse, status_code=status.HTTP_201_CREATED)
def ingest_regulation(
    payload: IngestionRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> Any:
    """
    Manually ingest regulation text for analysis and impact mapping.
    Source is tagged as FDA_API (this endpoint is for programmatic ingestion of
    fetched content, not user-uploaded PDFs).
    """
    hash_val = hashlib.sha256(payload.raw_content.encode("utf-8")).hexdigest()
    existing = (
        db.query(RegulationUpdate)
        .filter(RegulationUpdate.hash_value == hash_val)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A regulation with identical content hash has already been ingested.",
        )

    parsed: dict = {}
    lines = [
        line.strip()
        for line in payload.raw_content.split(".")
        if len(line.strip()) > 10
    ]
    for idx, line in enumerate(lines[:3]):
        parsed[f"section_1.{idx + 1}"] = line + "."

    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=payload.source_url,
        title=payload.title,
        published_date=datetime.now(timezone.utc),
        raw_content=payload.raw_content,
        parsed_sections=parsed,
        hash_value=hash_val,
        status="Not Analyzed",
        source=REGULATION_SOURCE_FDA_API,
    )

    db.add(reg)
    db.commit()
    db.refresh(reg)

    add_audit_event(
        db, reg.id, "regulation_imported", f"Regulation '{reg.title}' ingested via API."
    )

    try:
        final_state = trigger_agent_pipeline(
            regulation_id=str(reg.id),
            organization_id=tenant_id,
            raw_content=reg.raw_content,
        )
        reg.status = "Not Analyzed"
        reg.parsed_sections = {
            "sections": parsed,
            "classification": {
                "relevant": final_state.get("relevant", False),
                "category": final_state.get("category", "other"),
                "urgency": final_state.get("urgency", "low"),
                "affected_business_areas": final_state.get("affected_business_areas", []),
                "rationale": final_state.get("rationale", ""),
            },
        }
        db.add(reg)
        db.commit()
        db.refresh(reg)
        logger.info(f"LangGraph pipeline completed for regulation {reg.id}")
    except Exception as e:
        logger.error(f"LangGraph pipeline failed for regulation {reg.id}: {e}")
        # Ingestion succeeds even if AI pipeline fails

    return helper_map_regulation_response(reg)


# ---------------------------------------------------------------------------
# PDF upload — new primary ingestion path for user-uploaded documents
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=RegulationResponse, status_code=status.HTTP_201_CREATED)
async def upload_regulation_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    regulatory_authority: str = Form("FDA"),
    document_number: Optional[str] = Form(None),
    published_date: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    effective_date: Optional[str] = Form(None),
    summary: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> Any:
    """
    Upload a local PDF copy of a regulation document (e.g., an FDA guidance
    document downloaded from the FDA website).

    Workflow:
      1. Validate & save the uploaded PDF
      2. Extract text from the PDF
      3. Create a RegulationUpdate record tagged source=DOCUMENT_UPLOAD
      4. Generate embeddings and store in the vector knowledge base
      5. Trigger the AI pipeline for classification
    """
    from app.services.regulation_parser.pdf_parser import extract_text_from_pdf
    from app.services.embeddings.embedding_service import embedding_service
    from app.services.vector_db.qdrant_client import vector_db_client

    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB for regulation PDFs

    # 1. Validate file type & size
    filename = file.filename or "regulation.pdf"
    _, ext = os.path.splitext(filename.lower())
    if ext not in (".pdf", ".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Only PDF and TXT files are supported.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 20 MB limit.",
        )

    # 2. Save to disk
    storage_dir = "/app/storage/regulations"
    os.makedirs(storage_dir, exist_ok=True)
    file_id = uuid.uuid4()
    file_path = os.path.join(storage_dir, f"{file_id}{ext}")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # 3. Extract text
    try:
        if ext == ".pdf":
            raw_content = extract_text_from_pdf(file_path)
        else:
            raw_content = file_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from the uploaded file: {str(e)}",
        )

    if not raw_content or len(raw_content.strip()) < 50:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Extracted text is too short. The file may be a scanned image or empty.",
        )

    # 4. Deduplicate by content hash
    hash_val = hashlib.sha256(raw_content.encode("utf-8")).hexdigest()
    existing = (
        db.query(RegulationUpdate)
        .filter(RegulationUpdate.hash_value == hash_val)
        .first()
    )
    if existing:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A regulation with identical content has already been uploaded.",
        )

    # 5. Parse dates
    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return None

    pub_dt = _parse_dt(published_date) or datetime.now(timezone.utc)
    eff_dt = _parse_dt(effective_date)

    # 6. Build a unique source_url for uploaded documents (file-path based)
    source_url = f"upload://regulations/{file_id}{ext}"

    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=source_url,
        title=title,
        published_date=pub_dt,
        effective_date=eff_dt,
        raw_content=raw_content,
        parsed_sections=None,
        hash_value=hash_val,
        status="Not Analyzed",
        source=REGULATION_SOURCE_DOCUMENT_UPLOAD,
        document_number=document_number or None,
        regulatory_authority=regulatory_authority or "FDA",
        category=category or None,
        summary=summary or None,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    add_audit_event(
        db,
        reg.id,
        "regulation_uploaded",
        f"Regulation '{reg.title}' uploaded from local document.",
    )
    logger.info(f"Regulation document uploaded: {reg.id} — {reg.title}")

    # 7. Generate embeddings and index in vector knowledge base
    try:
        chunks = _chunk_text(raw_content)
        if chunks:
            vectors = embedding_service.get_embeddings(chunks)
            qdrant_chunks = [
                {"text": chunk, "vector": vec, "chunk_index": idx}
                for idx, (chunk, vec) in enumerate(zip(chunks, vectors))
            ]
            # Use regulation ID namespace to separate from SOP document chunks
            vector_db_client.upsert_chunks(reg.id, uuid.UUID(tenant_id), qdrant_chunks)
            logger.info(f"Indexed {len(chunks)} chunks for regulation {reg.id} in vector DB")
    except Exception as e:
        logger.warning(f"Vector indexing skipped for regulation {reg.id}: {e}")

    # 8. Trigger AI classification pipeline
    try:
        final_state = trigger_agent_pipeline(
            regulation_id=str(reg.id),
            organization_id=tenant_id,
            raw_content=raw_content,
        )
        reg.parsed_sections = {
            "classification": {
                "relevant": final_state.get("relevant", False),
                "category": final_state.get("category", "other"),
                "urgency": final_state.get("urgency", "low"),
                "affected_business_areas": final_state.get("affected_business_areas", []),
                "rationale": final_state.get("rationale", ""),
            }
        }
        db.add(reg)
        db.commit()
        db.refresh(reg)
        logger.info(f"AI pipeline complete for uploaded regulation {reg.id}")
    except Exception as e:
        logger.error(f"AI pipeline failed for uploaded regulation {reg.id}: {e}")

    return helper_map_regulation_response(reg)


# ---------------------------------------------------------------------------
# Status update
# ---------------------------------------------------------------------------

@router.patch("/{regulation_id}/status", response_model=RegulationResponse)
def update_regulation_status(
    regulation_id: uuid.UUID,
    status_payload: dict,
    db: Session = Depends(get_db),
) -> Any:
    regulation = (
        db.query(RegulationUpdate)
        .filter(RegulationUpdate.id == regulation_id)
        .first()
    )
    if not regulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regulation not found",
        )
    new_status = status_payload.get("status")
    if new_status:
        regulation.status = new_status
        if new_status == "Closed":
            add_audit_event(
                db, regulation_id, "case_closed", "Compliance Case was closed successfully."
            )
        else:
            add_audit_event(
                db,
                regulation_id,
                "status_updated",
                f"Compliance Case status updated to '{new_status}'.",
            )
        db.add(regulation)
        db.commit()
        db.refresh(regulation)
    return helper_map_regulation_response(regulation)
