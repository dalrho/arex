from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from app.core.dependencies import get_db, get_tenant_id
from app.models.organization import Organization

router = APIRouter()

class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str

    class Config:
        from_attributes = True

@router.get("/me", response_model=OrganizationResponse)
def get_current_org(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Retrieve current tenant organization workspace details.
    """
    # Try parsing tenant_id as UUID
    try:
        org_uuid = uuid.UUID(tenant_id)
    except ValueError:
        # Development fallback
        org = db.query(Organization).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        return org

    org = db.query(Organization).filter(Organization.id == org_uuid).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org
