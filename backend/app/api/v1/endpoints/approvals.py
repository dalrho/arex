import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os

from app.core.dependencies import get_db, get_current_user
from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.models.approval_record import ApprovalRecord
from app.models.user import User
from app.api.v1.schemas.approval import ApprovalDecisionRequest, ApprovalRecordResponse
from app.services.embeddings.embedding_service import embedding_service
from app.services.vector_db.qdrant_client import vector_db_client
from app.services.approval_workflow.workflow_state_machine import WorkflowStateMachine

router = APIRouter()

def chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))
        if i + chunk_size >= len(words):
            break
        i += (chunk_size - overlap)
    return chunks

@router.post("/remediation/{remediation_id}", response_model=ApprovalRecordResponse)
def submit_approval_decision(
    remediation_id: uuid.UUID,
    payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Submit an approval decision (APPROVED or REJECTED) for an AI proposed remediation draft.
    Triggers automated version control upgrades, updates disk storage, and syncs vector index embeddings upon approval.
    Logs an immutable record in the audit log (21 CFR Part 11 compliance).
    """
    # Enforce RBAC
    user_role = "user"
    if current_user:
        if isinstance(current_user, dict):
            user_role = current_user.get("role", "user")
        else:
            user_role = getattr(current_user, "role", "user")

    if user_role not in ["QA Manager", "Org Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only QA Manager or Org Admin roles can submit approval decisions."
        )

    draft = db.query(RemediationDraft).filter(RemediationDraft.id == remediation_id).first()
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remediation draft not found"
        )

    decision = payload.decision.upper()
    try:
        WorkflowStateMachine.validate_transition(draft.status, decision)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Extract reviewer ID from current user context
    reviewer_id = None
    if current_user:
        if isinstance(current_user, dict):
            user_id_str = current_user.get("id")
            reviewer_id = uuid.UUID(user_id_str) if user_id_str else None
        else:
            reviewer_id = current_user.id

    if not reviewer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Electronic signature execution requires a valid authenticated user session (21 CFR Part 11)."
        )

    # 1. Update draft status
    draft.status = decision
    draft.reviewer_id = reviewer_id
    draft.reviewed_at = datetime.now(timezone.utc)

    # 2. If approved, update active document and vector store
    if decision == "APPROVED":
        doc = db.query(Document).filter(Document.id == draft.document_id).first()
        if doc:
            # GxP Document Version Control Upgrade
            doc.version += 1
            doc.parsed_text = draft.proposed_text
            
            # Sync to physical storage
            try:
                with open(doc.file_path, "w", encoding="utf-8") as f:
                    f.write(draft.proposed_text)
            except OSError:
                pass

            # Sync Qdrant vector index
            try:
                # Delete old document vectors
                vector_db_client.delete_document_chunks(doc.id)
                # Re-index new text chunks
                text_chunks = chunk_text(draft.proposed_text)
                if text_chunks:
                    vectors = embedding_service.get_embeddings(text_chunks)
                    qdrant_chunks = [
                        {
                            "text": chunk_text_str,
                            "vector": vector,
                            "chunk_index": idx
                        }
                        for idx, (chunk_text_str, vector) in enumerate(zip(text_chunks, vectors))
                    ]
                    vector_db_client.upsert_chunks(doc.id, doc.organization_id, qdrant_chunks)
            except Exception:
                # Non-blocking indexing update
                pass

            db.add(doc)

    # 3. Write immutable audit record log (21 CFR Part 11)
    record = ApprovalRecord(
        id=uuid.uuid4(),
        item_type="remediation_draft",
        item_id=draft.id,
        status=decision,
        reviewer_id=reviewer_id,
        timestamp=datetime.now(timezone.utc),
        original_content={"text": draft.original_text},
        final_content={"text": draft.proposed_text if decision == "APPROVED" else draft.original_text}
    )

    db.add(draft)
    db.add(record)
    db.commit()
    db.refresh(record)

    return record

@router.get("/records", response_model=List[ApprovalRecordResponse])
def list_approval_records(
    db: Session = Depends(get_db)
) -> Any:
    """
    List all approval audit records (logs) for system audits.
    """
    records = db.query(ApprovalRecord).order_by(ApprovalRecord.timestamp.desc()).all()
    return records
