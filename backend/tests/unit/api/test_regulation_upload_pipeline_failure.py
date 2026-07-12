"""
Regression: AI pipeline failure must not break response serialization.

After add_audit_event commits, expire_on_commit leaves `reg` expired. Without
db.refresh in the pipeline except block, model_validate(reg) can raise
MissingGreenlet inside async upload handlers.
"""
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# graph_builder makedirs('/app/...') at import time — stub before regulations import
sys.modules.setdefault(
    "app.ai.graph_builder",
    MagicMock(trigger_agent_pipeline=MagicMock()),
)

from app.db.base import Base
from app.models.user import User  # noqa: F401
from app.models.organization import Organization  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.document_version import DocumentVersion  # noqa: F401
from app.models.regulation_update import RegulationUpdate, REGULATION_SOURCE_FDA_API
from app.models.remediation_draft import RemediationDraft  # noqa: F401
from app.models.approval_record import ApprovalRecord  # noqa: F401
from app.models.impact_assessment import ImpactAssessment  # noqa: F401
from app.models.implementation_task import ImplementationTask  # noqa: F401
from app.api.v1.endpoints.regulations import (
    IngestionRequest,
    helper_map_regulation_response,
    ingest_regulation,
)


@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=True)
    session = Session()
    yield session
    session.close()


def test_helper_map_after_refresh(db_session):
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url="https://example.com/reg-1",
        title="Test Regulation",
        published_date=datetime.now(timezone.utc),
        raw_content="A" * 100,
        parsed_sections=None,
        hash_value="a" * 64,
        status="Not Analyzed",
        source=REGULATION_SOURCE_FDA_API,
    )
    db_session.add(reg)
    db_session.commit()
    db_session.refresh(reg)
    response = helper_map_regulation_response(reg)
    assert response.title == "Test Regulation"
    assert response.status == "Not Analyzed"


def test_ingest_returns_response_when_pipeline_fails(db_session):
    """Mirrors upload failure path: audit commit expires reg; except refreshes."""
    payload = IngestionRequest(
        source_url=f"https://example.com/{uuid.uuid4()}",
        title="Pipeline Failure Ingest",
        raw_content=("Section one. " * 20),
    )

    with patch(
        "app.ai.agents.regulatory_intelligence_agent.run_regulatory_intelligence",
        side_effect=RuntimeError("429 RESOURCE_EXHAUSTED"),
    ), patch("app.api.v1.endpoints.regulations.add_audit_event") as mock_audit:

        def _audit(db, regulation_id, event_type, description, user_email=None):
            # Mirror real add_audit_event: commit expires session instances
            db.commit()

        mock_audit.side_effect = _audit
        result = ingest_regulation(
            payload=payload,
            db=db_session,
            tenant_id="9280d0d8-5527-4632-bd92-4fcf05c75462",
        )

    assert result.title == "Pipeline Failure Ingest"
    assert result.status == "Not Analyzed"
    assert result.id is not None


def test_upload_except_refreshes_before_map(db_session):
    """
    Directly exercise the upload failure pattern: expire via commit, refresh,
    then map — the same sequence as the fixed except block.
    """
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=f"upload://regulations/{uuid.uuid4()}.txt",
        title="Upload Pipeline Failure",
        published_date=datetime.now(timezone.utc),
        raw_content="Regulation body text. " * 30,
        parsed_sections=None,
        hash_value="b" * 64,
        status="Not Analyzed",
        source="DOCUMENT_UPLOAD",
    )
    db_session.add(reg)
    db_session.commit()
    db_session.refresh(reg)

    # Second commit (as add_audit_event does) expires attributes
    db_session.commit()

    # Fixed except path
    db_session.refresh(reg)
    result = helper_map_regulation_response(reg)

    assert result.title == "Upload Pipeline Failure"
    assert result.status == "Not Analyzed"
