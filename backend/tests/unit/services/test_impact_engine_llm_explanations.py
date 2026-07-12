"""
Impact engine should only include documents the LLM explicitly explained.
"""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
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
from app.models.impact_assessment import ImpactAssessment  # noqa: F401
from app.models.implementation_task import ImplementationTask  # noqa: F401
from app.core.dependencies import DEFAULT_ORG_ID
from app.services.compliance_impact.impact_engine import assess_compliance_impact


@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    yield session
    session.close()


def test_online_empty_llm_explanations_yields_empty_affected_docs(db_session):
    org_id = uuid.UUID(DEFAULT_ORG_ID)
    org = Organization(id=org_id, name="Test Org")
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=f"https://example.com/{uuid.uuid4()}",
        title="No-Impact Regulation",
        published_date=datetime.now(timezone.utc),
        raw_content="Administrative guidance with no SOP impact. " * 10,
        hash_value=uuid.uuid4().hex,
        status="Not Analyzed",
        source="DOCUMENT_UPLOAD",
    )
    doc = Document(
        id=uuid.uuid4(),
        organization_id=org_id,
        filename="SOP-Access-Control.pdf",
        file_path="/tmp/sop.pdf",
        version=1,
        parsed_text="Access control procedures.",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add_all([org, reg, doc])
    db_session.commit()

    llm_response = SimpleNamespace(
        risk_score=0.05,
        impact_level="Low",
        rationale="No company documents are affected by this regulation.",
        affected_departments=[],
        explanations={},
    )
    mock_llm = MagicMock()
    mock_llm.is_offline_mode.return_value = False
    mock_llm.get_completion.return_value = llm_response

    with patch(
        "app.services.compliance_impact.impact_engine.embedding_service.get_embedding",
        return_value=[0.1] * 8,
    ), patch(
        "app.services.compliance_impact.impact_engine.vector_db_client.search_chunks",
        return_value=[{
            "document_id": str(doc.id),
            "score": 0.92,
            "text": "Access control procedures.",
            "chunk_index": 0,
        }],
    ), patch(
        "app.ai.llm_client.llm_client",
        mock_llm,
    ):
        assessment = assess_compliance_impact(
            regulation_id=reg.id,
            organization_id=org_id,
            db=db_session,
        )

    assert assessment.affected_documents == []
    assert assessment.rationale == "No company documents are affected by this regulation."


def test_online_llm_explanations_include_matched_docs(db_session):
    org_id = uuid.UUID(DEFAULT_ORG_ID)
    org = Organization(id=org_id, name="Test Org")
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=f"https://example.com/{uuid.uuid4()}",
        title="Cybersecurity Update",
        published_date=datetime.now(timezone.utc),
        raw_content="New authentication requirements. " * 10,
        hash_value=uuid.uuid4().hex,
        status="Not Analyzed",
        source="DOCUMENT_UPLOAD",
    )
    doc = Document(
        id=uuid.uuid4(),
        organization_id=org_id,
        filename="SOP-Access-Control.pdf",
        file_path="/tmp/sop.pdf",
        version=1,
        parsed_text="Access control procedures.",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add_all([org, reg, doc])
    db_session.commit()

    llm_response = SimpleNamespace(
        risk_score=0.8,
        impact_level="High",
        rationale="SOP requires MFA updates.",
        affected_departments=["IT"],
        explanations={
            "SOP-Access-Control.pdf": "Must add multi-factor authentication requirements.",
        },
    )
    mock_llm = MagicMock()
    mock_llm.is_offline_mode.return_value = False
    mock_llm.get_completion.return_value = llm_response

    with patch(
        "app.services.compliance_impact.impact_engine.embedding_service.get_embedding",
        return_value=[0.1] * 8,
    ), patch(
        "app.services.compliance_impact.impact_engine.vector_db_client.search_chunks",
        return_value=[{
            "document_id": str(doc.id),
            "score": 0.91,
            "text": "Access control procedures.",
            "chunk_index": 0,
        }],
    ), patch(
        "app.ai.llm_client.llm_client",
        mock_llm,
    ):
        assessment = assess_compliance_impact(
            regulation_id=reg.id,
            organization_id=org_id,
            db=db_session,
        )

    assert len(assessment.affected_documents) == 1
    assert assessment.affected_documents[0]["document_name"] == "SOP-Access-Control.pdf"
    assert "multi-factor" in assessment.affected_documents[0]["explanation"]
