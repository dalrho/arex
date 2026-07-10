import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os

from app.core.dependencies import get_db, get_current_user
from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.regulation_update import RegulationUpdate
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

    # Verify user exists in DB for GxP ForeignKey constraint safety
    db_user = db.query(User).filter(User.id == reviewer_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Electronic signature execution requires a valid registered user. Please re-authenticate."
        )

    # 1. Update draft status
    draft.status = decision
    draft.reviewer_id = reviewer_id
    draft.reviewed_at = datetime.now(timezone.utc)

    # 2. If approved, update active document and vector store
    if decision == "APPROVED":
        doc = db.query(Document).filter(Document.id == draft.sop_id).first()
        if doc:
            # GxP Document Version Control Upgrade
            doc.version += 1
            doc.parsed_text = draft.proposed_revision
            
            # Sync to physical storage
            try:
                with open(doc.file_path, "w", encoding="utf-8") as f:
                    f.write(draft.proposed_revision)
            except OSError:
                pass

            # Create document version history entry
            reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == draft.regulation_id).first()
            reg_title = reg.title if reg else "FDA Regulation Update"
            reason = f"Remediated due to regulation update: {reg_title}"

            db_version = DocumentVersion(
                id=uuid.uuid4(),
                document_id=doc.id,
                version=doc.version,
                filename=doc.filename,
                file_path=doc.file_path,
                parsed_text=draft.proposed_revision,
                reason_for_revision=reason,
                created_at=datetime.now(timezone.utc)
            )
            db.add(db_version)
            
            if reg:
                # Update regulation status only if ALL drafts are approved
                all_drafts = db.query(RemediationDraft).filter(RemediationDraft.regulation_id == draft.regulation_id).all()
                if all(d.status == "APPROVED" or d.id == draft.id for d in all_drafts):
                    reg.status = "Draft Approved"
                    db.add(reg)

            from app.core.audit import add_audit_event
            add_audit_event(db, draft.regulation_id, "draft_approved", f"Remediation draft for '{doc.filename}' approved.")
            add_audit_event(db, draft.regulation_id, "document_updated", f"Document '{doc.filename}' updated to Version {doc.version}.")

            # Sync Qdrant vector index
            try:
                # Delete old document vectors
                vector_db_client.delete_document_chunks(doc.id)
                # Re-index new text chunks
                text_chunks = chunk_text(draft.proposed_revision)
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

    elif decision == "REJECTED":
        reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == draft.regulation_id).first()
        if reg:
            reg.status = "Needs Revision"
            db.add(reg)
            
        from app.core.audit import add_audit_event
        doc = db.query(Document).filter(Document.id == draft.sop_id).first()
        doc_name = doc.filename if doc else str(draft.sop_id)
        add_audit_event(db, draft.regulation_id, "draft_rejected", f"Remediation draft for '{doc_name}' rejected.")


    # 3. Write immutable audit record log (21 CFR Part 11)
    record = ApprovalRecord(
        id=uuid.uuid4(),
        item_type="remediation_draft",
        item_id=draft.id,
        status=decision,
        reviewer_id=reviewer_id,
        timestamp=datetime.now(timezone.utc),
        original_content={"text": draft.current_content},
        final_content={"text": draft.proposed_revision if decision == "APPROVED" else draft.current_content}
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
