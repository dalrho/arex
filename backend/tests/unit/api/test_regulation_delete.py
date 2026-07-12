import os
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Stub trigger_agent_pipeline to avoid graph builder import side-effects
sys.modules.setdefault(
    "app.ai.graph_builder",
    MagicMock(trigger_agent_pipeline=MagicMock()),
)

from app.db.base import Base
from app.models.user import User  # noqa: F401
from app.models.organization import Organization  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.document_version import DocumentVersion  # noqa: F401
from app.models.regulation_update import RegulationUpdate, REGULATION_SOURCE_DOCUMENT_UPLOAD
from app.models.remediation_draft import RemediationDraft
from app.models.implementation_task import ImplementationTask
from app.models.approval_record import ApprovalRecord  # noqa: F401
from app.models.impact_assessment import ImpactAssessment  # noqa: F401
from app.api.v1.endpoints.regulations import delete_regulation


@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=True)
    session = Session()
    yield session
    session.close()


def test_delete_regulation_not_found(db_session):
    """Deleting a non-existent regulation raises 404."""
    with pytest.raises(HTTPException) as exc_info:
        delete_regulation(
            regulation_id=uuid.uuid4(),
            db=db_session,
            tenant_id="test-tenant",
        )
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc_info.value.detail == "Regulation not found"


def test_delete_regulation_safe_success(db_session):
    """Deleting a regulation with no downstream artifacts succeeds."""
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url="upload://regulations/test_file.pdf",
        title="Test Safe Regulation",
        published_date=datetime.now(timezone.utc),
        raw_content="Raw regulation body",
        hash_value="h" * 64,
        status="Not Analyzed",
        source=REGULATION_SOURCE_DOCUMENT_UPLOAD,
    )
    db_session.add(reg)
    db_session.commit()

    with patch("os.path.exists", return_value=True) as mock_exists, \
         patch("os.remove") as mock_remove, \
         patch("app.services.vector_db.qdrant_client.vector_db_client.delete_document_chunks") as mock_vector_delete:
        
        delete_regulation(
            regulation_id=reg.id,
            db=db_session,
            tenant_id="test-tenant",
        )

        mock_exists.assert_called_once_with("/app/storage/regulations/test_file.pdf")
        mock_remove.assert_called_once_with("/app/storage/regulations/test_file.pdf")
        mock_vector_delete.assert_called_once_with(reg.id)

    # Verify database record is gone
    db_reg = db_session.query(RegulationUpdate).filter_by(id=reg.id).first()
    assert db_reg is None


def test_delete_regulation_blocked_by_remediation_drafts(db_session):
    """Deleting a regulation with remediation drafts is blocked (400 Bad Request)."""
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url="upload://regulations/test_file.pdf",
        title="Test Safe Regulation",
        published_date=datetime.now(timezone.utc),
        raw_content="Raw regulation body",
        hash_value="h" * 64,
        status="Under Review",
        source=REGULATION_SOURCE_DOCUMENT_UPLOAD,
    )
    db_session.add(reg)
    db_session.commit()

    draft = RemediationDraft(
        id=uuid.uuid4(),
        regulation_id=reg.id,
        sop_id=uuid.uuid4(),
        status="UNDER_REVIEW",
        current_content="Original SOP clause",
        proposed_revision="Updated SOP clause",
        explanation="Regulatory update alignment",
    )
    db_session.add(draft)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        delete_regulation(
            regulation_id=reg.id,
            db=db_session,
            tenant_id="test-tenant",
        )
    
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "active remediation drafts or implementation tasks exist" in exc_info.value.detail


def test_delete_regulation_blocked_by_implementation_tasks(db_session):
    """Deleting a regulation with implementation tasks is blocked (400 Bad Request)."""
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url="upload://regulations/test_file.pdf",
        title="Test Safe Regulation",
        published_date=datetime.now(timezone.utc),
        raw_content="Raw regulation body",
        hash_value="h" * 64,
        status="Under Review",
        source=REGULATION_SOURCE_DOCUMENT_UPLOAD,
    )
    db_session.add(reg)
    db_session.commit()

    task = ImplementationTask(
        id=uuid.uuid4(),
        regulation_id=reg.id,
        title="Update Training records",
        description="Verify SOP training compliance",
        status="TODO",
        department="QA",
    )
    db_session.add(task)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        delete_regulation(
            regulation_id=reg.id,
            db=db_session,
            tenant_id="test-tenant",
        )
    
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "active remediation drafts or implementation tasks exist" in exc_info.value.detail
