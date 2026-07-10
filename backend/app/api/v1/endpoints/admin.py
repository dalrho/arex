"""
Admin endpoint — Data Management.

Provides:
  GET  /admin/stats   — counts of all application data objects
  POST /admin/reset   — wipes all application-generated data (requires confirmation)
"""
import logging
import os
import shutil
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.approval_record import ApprovalRecord
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.impact_assessment import ImpactAssessment
from app.models.implementation_task import ImplementationTask
from app.models.regulation_update import RegulationUpdate
from app.models.remediation_draft import RemediationDraft

logger = logging.getLogger("arex.api.admin")

router = APIRouter()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class DataStats(BaseModel):
    total_regulations: int
    total_documents: int
    total_compliance_cases: int
    total_knowledge_base_documents: int
    total_impact_assessments: int
    total_remediation_drafts: int
    total_implementation_tasks: int


@router.get("/stats", response_model=DataStats)
def get_data_stats(db: Session = Depends(get_db)) -> Any:
    """
    Return aggregate counts of all application-generated data objects.
    Used by the Settings → Data Management page.
    """
    total_regulations = db.query(RegulationUpdate).count()
    total_documents = db.query(Document).count()
    # "Compliance cases" are regulations that have at least one impact assessment
    total_cases = db.query(ImpactAssessment.regulation_id).distinct().count()
    # Knowledge base documents = all uploaded SOP/QMS documents
    total_kb_docs = db.query(Document).count()
    total_impact = db.query(ImpactAssessment).count()
    total_drafts = db.query(RemediationDraft).count()
    total_tasks = db.query(ImplementationTask).count()

    return DataStats(
        total_regulations=total_regulations,
        total_documents=total_documents,
        total_compliance_cases=total_cases,
        total_knowledge_base_documents=total_kb_docs,
        total_impact_assessments=total_impact,
        total_remediation_drafts=total_drafts,
        total_implementation_tasks=total_tasks,
    )


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

class ResetRequest(BaseModel):
    confirmation: str  # Must equal "RESET"


class ResetResponse(BaseModel):
    status: str
    message: str
    deleted: dict


@router.post("/reset", response_model=ResetResponse)
def reset_application_data(
    payload: ResetRequest,
    db: Session = Depends(get_db),
) -> Any:
    """
    Permanently delete all application-generated data.

    This removes:
    - All regulations (FDA API and uploaded)
    - All uploaded regulation PDFs from disk
    - All uploaded SOP/QMS documents and their files
    - All compliance impact assessments
    - All remediation drafts
    - All implementation tasks
    - All approval records
    - All document versions
    - Vector DB collections are reset

    The reset leaves the application in a clean first-run state.
    Requires the caller to pass confirmation="RESET".
    """
    if payload.confirmation != "RESET":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Confirmation value must be exactly "RESET".',
        )

    logger.warning("Admin reset initiated — deleting all application data.")

    counts: dict[str, int] = {}

    try:
        # Count before deletion for the response summary
        counts["approval_records"] = db.query(ApprovalRecord).count()
        counts["implementation_tasks"] = db.query(ImplementationTask).count()
        counts["remediation_drafts"] = db.query(RemediationDraft).count()
        counts["impact_assessments"] = db.query(ImpactAssessment).count()
        counts["document_versions"] = db.query(DocumentVersion).count()
        counts["documents"] = db.query(Document).count()
        counts["regulations"] = db.query(RegulationUpdate).count()

        # Collect file paths before deletion so we can remove them from disk
        doc_paths = [
            d.file_path
            for d in db.query(Document.file_path).all()
            if d.file_path
        ]

        # Delete in foreign-key order
        db.query(ApprovalRecord).delete(synchronize_session="fetch")
        db.query(ImplementationTask).delete(synchronize_session="fetch")
        db.query(RemediationDraft).delete(synchronize_session="fetch")
        db.query(ImpactAssessment).delete(synchronize_session="fetch")
        db.query(DocumentVersion).delete(synchronize_session="fetch")
        db.query(Document).delete(synchronize_session="fetch")
        db.query(RegulationUpdate).delete(synchronize_session="fetch")
        db.commit()

        logger.info("Database tables cleared.")

        # Remove uploaded files from disk
        deleted_files = 0
        for path in doc_paths:
            try:
                if os.path.isfile(path):
                    os.remove(path)
                    deleted_files += 1
            except OSError as e:
                logger.warning(f"Could not remove file {path}: {e}")

        # Remove uploaded regulation PDFs directory
        reg_storage_dir = "/app/storage/regulations"
        if os.path.isdir(reg_storage_dir):
            try:
                shutil.rmtree(reg_storage_dir)
                os.makedirs(reg_storage_dir, exist_ok=True)
                logger.info("Regulation storage directory cleared.")
            except OSError as e:
                logger.warning(f"Could not clear regulation storage: {e}")

        counts["files_removed"] = deleted_files

        # Reset the Qdrant vector collection
        try:
            from app.services.vector_db.qdrant_client import vector_db_client
            vector_db_client.init_collection(force_recreate=True)
            logger.info("Qdrant vector collection reset.")
            counts["vector_collections_reset"] = 1
        except Exception as e:
            logger.warning(f"Could not reset Qdrant collection: {e}")
            counts["vector_collections_reset"] = 0

        logger.warning("Admin reset complete.")

        return ResetResponse(
            status="success",
            message="All application data has been permanently deleted. The application is in a clean first-run state.",
            deleted=counts,
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Reset failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset failed: {str(e)}",
        )
