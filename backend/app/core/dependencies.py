from typing import Generator, Optional

from fastapi import Header
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# Configure SQLAlchemy connection engine and session factory
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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


def get_tenant_id(
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")
) -> str:
    """
    Dependency to enforce multi-tenant/organization isolation.
    Extracts the tenant organization ID from custom X-Tenant-ID header.
    Falls back to a default organization identifier for MVP/development.
    """
    if not x_tenant_id:
        return "default-org-id"
    return x_tenant_id
