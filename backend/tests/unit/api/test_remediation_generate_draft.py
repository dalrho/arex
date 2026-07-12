"""
Regression: Generate Draft must not 500 when matched docs lack parsed_text.

Covers logger availability on the endpoint error path and Proposed New SOP
fallback when all matched documents are skipped.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.user import User  # noqa: F401
from app.models.organization import Organization  # noqa: F401
from app.models.document import Document
from app.models.document_version import DocumentVersion  # noqa: F401
from app.models.regulation_update import RegulationUpdate
from app.models.remediation_draft import RemediationDraft  # noqa: F401
from app.models.approval_record import ApprovalRecord  # noqa: F401
from app.models.impact_assessment import ImpactAssessment
from app.models.implementation_task import ImplementationTask  # noqa: F401
from app.ai.agents.remediation_agent import run_remediation_agent
from app.api.v1.endpoints import remediation as remediation_endpoint
from app.core.dependencies import DEFAULT_ORG_ID


@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=True)
    session = Session()
    yield session
    session.close()


def _seed_regulation_and_empty_doc(db_session):
    org_id = uuid.UUID(DEFAULT_ORG_ID)
    org = Organization(
        id=org_id,
        name="Test Org",
    )
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=f"https://example.com/{uuid.uuid4()}",
        title="FDA 2026 Cybersecurity Mandate",
        published_date=datetime.now(timezone.utc),
        raw_content="Cybersecurity requirements for medical devices. " * 10,
        parsed_sections=None,
        hash_value=uuid.uuid4().hex,
        status="Impact Assessment Complete",
        source="DOCUMENT_UPLOAD",
    )
    doc = Document(
        id=uuid.uuid4(),
        organization_id=org_id,
        filename="empty-sop.pdf",
        file_path="/tmp/empty-sop.pdf",
        version=1,
        parsed_text=None,
        created_at=datetime.now(timezone.utc),
    )
    assessment = ImpactAssessment(
        id=uuid.uuid4(),
        regulation_id=reg.id,
        organization_id=org_id,
        risk_score=1.0,
        impact_level="Low",
        rationale="Test assessment",
        affected_departments=["QA"],
        affected_documents=[{"document_id": str(doc.id), "filename": doc.filename}],
        status="ANALYSIS_COMPLETE",
    )
    db_session.add_all([org, reg, doc, assessment])
    db_session.commit()
    return reg, doc, assessment


def test_agent_falls_back_to_proposed_new_sop_when_docs_empty(db_session, tmp_path, monkeypatch):
    reg, doc, _ = _seed_regulation_and_empty_doc(db_session)

    monkeypatch.setattr(
        "app.ai.agents.remediation_agent.SessionLocal",
        lambda: db_session,
    )
    # Prevent closing the shared test session in finally
    db_session.close = MagicMock()

    storage = tmp_path / "storage"
    storage.mkdir()

    with patch("app.ai.agents.remediation_agent.llm_client") as mock_llm, patch(
        "docx.Document"
    ) as mock_docx:
        mock_llm.is_offline_mode.return_value = True
        mock_llm.get_completion.side_effect = RuntimeError("quota")
        docx_inst = MagicMock()
        mock_docx.return_value = docx_inst

        # Force storage under tmp
        with patch("app.ai.agents.remediation_agent.os.makedirs"), patch(
            "app.ai.agents.remediation_agent.os.path.dirname",
            return_value=str(storage),
        ):
            # Override file_path construction by patching uuid and letting save no-op
            docx_inst.save = MagicMock()

            result = run_remediation_agent(
                {
                    "regulation_id": str(reg.id),
                    "organization_id": DEFAULT_ORG_ID,
                    "matched_document_ids": [str(doc.id)],
                }
            )

    assert len(result["remediation_draft_ids"]) == 1


def test_trigger_endpoint_logger_exists_on_failure(db_session):
    """Error handler must use a defined logger (no NameError -> 500)."""
    assert hasattr(remediation_endpoint, "logger")
    remediation_endpoint.logger.error("smoke log for remediation endpoint")


def test_trigger_returns_400_not_500_when_agent_returns_empty(db_session):
    reg, _, assessment = _seed_regulation_and_empty_doc(db_session)
    org_id = DEFAULT_ORG_ID

    with patch(
        "app.api.v1.endpoints.remediation.run_remediation_agent",
        return_value={"remediation_draft_ids": []},
    ):
        with pytest.raises(HTTPException) as exc_info:
            remediation_endpoint.trigger_remediation_drafts(
                regulation_id=reg.id,
                payload=remediation_endpoint.RemediationDraftRequest(
                    document_ids=[uuid.UUID(assessment.affected_documents[0]["document_id"])]
                ),
                db=db_session,
                tenant_id=org_id,
            )

    assert exc_info.value.status_code == 400
    assert "No remediation drafts could be produced" in exc_info.value.detail
