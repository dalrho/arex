"""
Admin endpoint — Data Management.

Provides:
  GET  /admin/stats   — counts of all application data objects
  POST /admin/reset   — wipes ALL workspace-specific data (requires confirmation)

Reset Workspace guarantees a true "fresh installation" state:
  - All Postgres records (regulations, documents, assessments, drafts, tasks, etc.)
  - All uploaded files on disk (/app/storage/**)
  - All Qdrant vector embeddings (collection is dropped and recreated)
  - The LangGraph SQLite checkpoint store (checkpoints.sqlite)
    → prevents the "already analyzed" false-positive on re-upload of same regulation
"""
import logging
import os
import glob
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

# Storage root used by all file-writing endpoints
_STORAGE_ROOT = "/app/storage"

# Sub-paths that are recreated as empty directories after clearing
_RECREATE_DIRS = [
    os.path.join(_STORAGE_ROOT, "regulations"),
]


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
    Permanently delete ALL workspace-specific data.

    The reset is intentionally exhaustive — every storage location that could
    cause the system to treat a re-uploaded document as "already analyzed" is
    cleared:

    Database (Postgres)
    -------------------
    - approval_records
    - implementation_tasks
    - remediation_drafts
    - impact_assessments
    - document_versions
    - documents
    - regulation_updates  (includes the hash_value fingerprints used for
                           duplicate detection — clearing these allows the
                           same regulation PDF to be re-uploaded and
                           fully re-analyzed)

    File system (/app/storage)
    --------------------------
    - /app/storage/regulations/**  — uploaded regulation PDFs
    - /app/storage/*.pdf|txt|docx  — uploaded company SOP/QMS documents
    - /app/storage/*_v*.txt        — versioned approval files
    - /app/storage/checkpoints.sqlite — LangGraph AI orchestration state

    Vector database (Qdrant)
    ------------------------
    - The entire "arex_docs" collection is dropped and recreated empty.

    LangGraph checkpoint store
    --------------------------
    - checkpoints.sqlite is deleted and the graph is recompiled from scratch.
      Without this step, LangGraph's SqliteSaver retains per-thread state
      that can cause the AI pipeline to skip re-analysis of regulations whose
      thread_id (reg_<uuid>) it recognises from a prior run.

    Requires the caller to pass confirmation="RESET".
    """
    if payload.confirmation != "RESET":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Confirmation value must be exactly "RESET".',
        )

    logger.warning("Admin reset initiated — deleting ALL workspace data.")

    counts: dict[str, int] = {}

    try:
        # ------------------------------------------------------------------
        # 1. Count everything before deletion (for the response summary)
        # ------------------------------------------------------------------
        counts["approval_records"] = db.query(ApprovalRecord).count()
        counts["implementation_tasks"] = db.query(ImplementationTask).count()
        counts["remediation_drafts"] = db.query(RemediationDraft).count()
        counts["impact_assessments"] = db.query(ImpactAssessment).count()
        counts["document_versions"] = db.query(DocumentVersion).count()
        counts["documents"] = db.query(Document).count()
        counts["regulations"] = db.query(RegulationUpdate).count()

        # ------------------------------------------------------------------
        # 2. Delete all Postgres records (in FK-safe order)
        # ------------------------------------------------------------------
        db.query(ApprovalRecord).delete(synchronize_session="fetch")
        db.query(ImplementationTask).delete(synchronize_session="fetch")
        db.query(RemediationDraft).delete(synchronize_session="fetch")
        db.query(ImpactAssessment).delete(synchronize_session="fetch")
        db.query(DocumentVersion).delete(synchronize_session="fetch")
        db.query(Document).delete(synchronize_session="fetch")
        db.query(RegulationUpdate).delete(synchronize_session="fetch")
        db.commit()

        logger.info("All Postgres tables cleared (including regulation hash_value fingerprints).")

        # ------------------------------------------------------------------
        # 3. Wipe the entire /app/storage directory
        #    We clear all contents but keep the root directory itself and
        #    recreate the required sub-directories as empty folders.
        # ------------------------------------------------------------------
        files_removed = 0
        dirs_removed = 0

        if os.path.isdir(_STORAGE_ROOT):
            for entry in os.listdir(_STORAGE_ROOT):
                entry_path = os.path.join(_STORAGE_ROOT, entry)
                try:
                    if os.path.isfile(entry_path) or os.path.islink(entry_path):
                        os.remove(entry_path)
                        files_removed += 1
                        logger.debug(f"Removed file: {entry_path}")
                    elif os.path.isdir(entry_path):
                        shutil.rmtree(entry_path)
                        dirs_removed += 1
                        logger.debug(f"Removed directory: {entry_path}")
                except OSError as e:
                    logger.warning(f"Could not remove {entry_path}: {e}")

        # Recreate required sub-directories
        for dir_path in _RECREATE_DIRS:
            os.makedirs(dir_path, exist_ok=True)

        counts["files_removed"] = files_removed
        counts["dirs_removed"] = dirs_removed
        logger.info(
            f"Storage cleared: {files_removed} file(s) and {dirs_removed} directory/ies removed. "
            f"Sub-directories recreated: {_RECREATE_DIRS}"
        )

        # ------------------------------------------------------------------
        # 4. Reset LangGraph checkpoint store
        #    Closes the open SQLite connection, deletes checkpoints.sqlite,
        #    and recompiles the graph with a fresh empty store.
        #    This prevents the "already analyzed" false-positive that occurs
        #    when LangGraph resumes from a cached thread checkpoint.
        # ------------------------------------------------------------------
        try:
            from app.ai.graph_builder import reset_graph_checkpoints
            reset_graph_checkpoints()
            counts["langgraph_checkpoints_reset"] = 1
            logger.info("LangGraph checkpoint store reset successfully.")
        except Exception as e:
            logger.warning(f"Could not reset LangGraph checkpoints: {e}")
            counts["langgraph_checkpoints_reset"] = 0

        # ------------------------------------------------------------------
        # 5. Reset ALL Qdrant vector collections
        #    Drops every collection in the vector DB (including stale ones
        #    from previous backend versions, e.g. "sentinel_docs"), then
        #    recreates the active "arex_docs" collection as empty.
        # ------------------------------------------------------------------
        try:
            from qdrant_client import QdrantClient as RawQdrant
            from app.core.config import settings
            from app.services.vector_db.qdrant_client import vector_db_client

            raw_client = RawQdrant(url=settings.QDRANT_URL)
            all_collections = raw_client.get_collections().collections
            deleted_collections = []
            for col in all_collections:
                try:
                    raw_client.delete_collection(col.name)
                    deleted_collections.append(col.name)
                    logger.info(f"Deleted Qdrant collection: '{col.name}'")
                except Exception as ce:
                    logger.warning(f"Could not delete Qdrant collection '{col.name}': {ce}")

            # Recreate the active collection
            vector_db_client.init_collection(force_recreate=False)
            counts["vector_collections_reset"] = len(deleted_collections)
            counts["vector_collections_deleted"] = deleted_collections
            logger.info(
                f"Qdrant reset complete: deleted {deleted_collections}, "
                "recreated 'arex_docs'."
            )
        except Exception as e:
            logger.warning(f"Could not reset Qdrant collections: {e}")
            counts["vector_collections_reset"] = 0

        logger.warning("Admin reset complete — workspace is in a clean first-run state.")

        return ResetResponse(
            status="success",
            message=(
                "All workspace data has been permanently deleted. "
                "The application is in a clean first-run state. "
                "Re-uploading the same regulation will trigger a completely new AI analysis."
            ),
            deleted=counts,
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Reset failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset failed: {str(e)}",
        )
