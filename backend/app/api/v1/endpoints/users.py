import uuid
from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_tenant_id
from app.models.user import User

router = APIRouter()


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> Any:
    """
    List all users in the current organization (tenant-scoped).
    """
    org_id = uuid.UUID(tenant_id)
    users = (
        db.query(User)
        .filter(User.organization_id == org_id)
        .order_by(User.created_at.asc())
        .all()
    )
    return users
