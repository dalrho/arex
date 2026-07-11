from typing import Generator, Optional
import uuid
from datetime import datetime, timezone

from fastapi import Header
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import get_current_user  # re-exported for backward compatibility

# Configure SQLAlchemy connection engine and session factory
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# The single demo organization ID used throughout the platform.
# This org is auto-created on first request — no seed script required.
DEFAULT_ORG_ID = "9280d0d8-5527-4632-bd92-4fcf05c75462"


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency to retrieve the local database session.
    Automatically closes the connection session after processing the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_org_exists(db: Session, org_id: str) -> None:
    """
    Auto-provision the default organization on first request.
    This replaces the need for any seed script — the app is fully self-bootstrapping.
    """
    from app.models.organization import Organization  # local import to avoid circular deps
    org_uuid = uuid.UUID(org_id)
    exists = db.query(Organization).filter(Organization.id == org_uuid).first()
    if not exists:
        org = Organization(
            id=org_uuid,
            name="My Organization",
            created_at=datetime.now(timezone.utc),
        )
        db.add(org)
        db.commit()


def get_tenant_id(
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")
) -> str:
    """
    Dependency to enforce multi-tenant/organization isolation.
    Extracts the tenant organization ID from custom X-Tenant-ID header.
    Falls back to the default organization identifier for MVP/development.
    Auto-creates the org in the database if it doesn't exist yet.
    """
    tenant_id = x_tenant_id if x_tenant_id else DEFAULT_ORG_ID

    # Auto-provision the org so the app works with a blank DB (no seed script needed)
    db = SessionLocal()
    try:
        _ensure_org_exists(db, tenant_id)
    finally:
        db.close()

    return tenant_id
