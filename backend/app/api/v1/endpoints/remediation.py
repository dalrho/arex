import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from datetime import datetime, timezone
from app.core.dependencies import get_db, get_tenant_id, get_current_user
from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.models.user import User
from app.models.approval_record import ApprovalRecord
from app.api.v1.schemas.remediation import RemediationResponse, RemediationUpdateRequest
from app.services.approval_workflow.workflow_state_machine import WorkflowStateMachine

router = APIRouter()

@router.get("/", response_model=List[RemediationResponse])
def list_remediation_drafts(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    List all AI-generated remediation drafts scoped for the tenant.
    """
    org_id = uuid.UUID(tenant_id)
    drafts = db.query(RemediationDraft).join(Document).filter(
        Document.organization_id == org_id
    ).all()
    return drafts

@router.get("/{remediation_id}", response_model=RemediationResponse)
def get_remediation_draft(
    remediation_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Get details of a specific remediation draft.
    """
    org_id = uuid.UUID(tenant_id)
    draft = db.query(RemediationDraft).join(Document).filter(
        RemediationDraft.id == remediation_id,
        Document.organization_id == org_id
    ).first()
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remediation draft not found"
        )
    return draft

@router.put("/{remediation_id}", response_model=RemediationResponse)
def update_remediation_draft(
    remediation_id: uuid.UUID,
    payload: RemediationUpdateRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Allows human editors to modify the AI-proposed remediation draft before submission.
    """
    org_id = uuid.UUID(tenant_id)
    draft = db.query(RemediationDraft).join(Document).filter(
        RemediationDraft.id == remediation_id,
        Document.organization_id == org_id
    ).first()
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remediation draft not found"
        )

    # Validate if modification is permitted
    try:
        WorkflowStateMachine.validate_edit(draft.status)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    old_text = draft.proposed_text
    draft.proposed_text = payload.proposed_text
    if payload.diff_content is not None:
        draft.diff_content = payload.diff_content

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

    # Log the edit as EDITED in audit log
    record = ApprovalRecord(
        id=uuid.uuid4(),
        item_type="remediation_draft",
        item_id=draft.id,
        status="EDITED",
        reviewer_id=reviewer_id,
        timestamp=datetime.now(timezone.utc),
        original_content={"text": old_text},
        final_content={"text": payload.proposed_text}
    )

    db.add(draft)
    db.add(record)
    db.commit()
    db.refresh(draft)
    return draft

@router.post("/{remediation_id}/reset", response_model=RemediationResponse)
def reset_remediation_draft(
    remediation_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Resets a rejected remediation draft back to PENDING_REVIEW status,
    allowing it to be edited and approved/rejected again.
    """
    org_id = uuid.UUID(tenant_id)
    draft = db.query(RemediationDraft).join(Document).filter(
        RemediationDraft.id == remediation_id,
        Document.organization_id == org_id
    ).first()
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remediation draft not found"
        )

    # Enforce RBAC (only QA Manager or Org Admin can reset)
    user_role = "user"
    if current_user:
        if isinstance(current_user, dict):
            user_role = current_user.get("role", "user")
        else:
            user_role = getattr(current_user, "role", "user")

    if user_role not in ["QA Manager", "Org Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only QA Manager or Org Admin roles can reset remediation drafts."
        )

    try:
        WorkflowStateMachine.validate_transition(draft.status, "PENDING_REVIEW")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    old_status = draft.status
    draft.status = "PENDING_REVIEW"
    draft.reviewer_id = None
    draft.reviewed_at = None

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

    # Log the reset as EDITED in audit log
    record = ApprovalRecord(
        id=uuid.uuid4(),
        item_type="remediation_draft",
        item_id=draft.id,
        status="EDITED",
        reviewer_id=reviewer_id,
        timestamp=datetime.now(timezone.utc),
        original_content={"status": old_status, "text": draft.proposed_text},
        final_content={"status": "PENDING_REVIEW", "text": draft.proposed_text}
    )
    db.add(draft)
    db.add(record)
    db.commit()
    db.refresh(draft)
    return draft

from app.ai.agents.remediation_agent import run_remediation_agent
from app.models.impact_assessment import ImpactAssessment
from app.models.regulation_update import RegulationUpdate

@router.post("/regulation/{regulation_id}", response_model=List[RemediationResponse], status_code=status.HTTP_201_CREATED)
def trigger_remediation_drafts(
    regulation_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Trigger the Remediation Agent to generate drafts for all impacted documents of the given regulation.
    """
    org_id = uuid.UUID(tenant_id)
    
    # Check regulation
    reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == regulation_id).first()
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regulation update not found"
        )
        
    # Get impact assessment
    assessment = db.query(ImpactAssessment).filter(
        ImpactAssessment.regulation_id == regulation_id,
        ImpactAssessment.organization_id == org_id
    ).first()
    
    # If no assessment exists yet, trigger it
    if not assessment:
        from app.services.compliance_impact.impact_engine import assess_compliance_impact
        try:
            assessment = assess_compliance_impact(
                regulation_id=regulation_id,
                organization_id=org_id,
                db=db
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate dependency impact assessment: {str(e)}"
            )

    # Search vector DB for matching document IDs
    from app.services.embeddings.embedding_service import embedding_service
    from app.services.vector_db.qdrant_client import vector_db_client
    
    query_vector = embedding_service.get_embedding(reg.raw_content)
    matched_chunks = vector_db_client.search_chunks(
        query_vector=query_vector,
        organization_id=org_id,
        limit=20
    )
    
    matched_doc_ids = list(set([
        uuid.UUID(c["document_id"])
        for c in matched_chunks
        if c.get("document_id") and c.get("score", 0.0) >= 0.75
    ]))
    
    if not matched_doc_ids:
        return []
        
    # Prepare graph state format
    state = {
        "regulation_id": str(regulation_id),
        "organization_id": str(org_id),
        "matched_document_ids": [str(d) for d in matched_doc_ids]
    }
    
    # Run the remediation agent
    res = run_remediation_agent(state)
    draft_ids = [uuid.UUID(d_id) for d_id in res.get("remediation_draft_ids", [])]
    
    # Query database and return drafts
    drafts = db.query(RemediationDraft).filter(RemediationDraft.id.in_(draft_ids)).all()
    return drafts

