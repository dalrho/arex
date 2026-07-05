import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_tenant_id
from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.api.v1.schemas.remediation import RemediationResponse, RemediationUpdateRequest

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
    tenant_id: str = Depends(get_tenant_id)
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

    draft.proposed_text = payload.proposed_text
    if payload.diff_content is not None:
        draft.diff_content = payload.diff_content

    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft
