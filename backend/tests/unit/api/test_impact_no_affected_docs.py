"""
Auto-close compliance cases when impact assessment finds zero affected documents.
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
from app.models.document import Document  # noqa: F401
from app.models.document_version import DocumentVersion  # noqa: F401
from app.models.regulation_update import RegulationUpdate
from app.models.remediation_draft import RemediationDraft  # noqa: F401
from app.models.approval_record import ApprovalRecord  # noqa: F401
from app.models.impact_assessment import ImpactAssessment
from app.models.implementation_task import ImplementationTask  # noqa: F401
from app.api.v1.endpoints import impact as impact_endpoint
from app.api.v1.endpoints import remediation as remediation_endpoint
from app.api.v1.schemas.impact import ImpactResponse
from app.core.dependencies import DEFAULT_ORG_ID


@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    yield session
    session.close()


def _seed_org_and_regulation(db_session, status="Not Analyzed"):
    org_id = uuid.UUID(DEFAULT_ORG_ID)
    org = Organization(id=org_id, name="Test Org")
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url=f"https://example.com/{uuid.uuid4()}",
        title="FDA Guidance With No SOP Impact",
        published_date=datetime.now(timezone.utc),
        raw_content="Administrative filing guidance unrelated to company SOPs. " * 5,
        parsed_sections={"classification": {"relevant": True, "rationale": "ok"}},
        hash_value=uuid.uuid4().hex,
        status=status,
        source="DOCUMENT_UPLOAD",
    )
    db_session.add_all([org, reg])
    db_session.commit()
    return org_id, reg


def _make_assessment(reg, org_id, affected_documents):
    return ImpactAssessment(
        id=uuid.uuid4(),
        regulation_id=reg.id,
        organization_id=org_id,
        risk_score=0.1,
        impact_level="Low",
        rationale="No company documents are affected.",
        affected_departments=[],
        affected_documents=affected_documents,
        status="pending",
    )


def test_impact_response_includes_affected_documents_count():
    org_id = uuid.uuid4()
    reg_id = uuid.uuid4()
    response = ImpactResponse(
        id=uuid.uuid4(),
        regulation_id=reg_id,
        organization_id=org_id,
        risk_score=0.2,
        impact_level="Low",
        rationale="None affected",
        affected_departments=[],
        affected_documents=[],
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    assert response.affected_documents_count == 0

    response_with_docs = ImpactResponse(
        id=uuid.uuid4(),
        regulation_id=reg_id,
        organization_id=org_id,
        risk_score=0.8,
        impact_level="High",
        rationale="SOP gap",
        affected_departments=["QA"],
        affected_documents=[{"document_id": str(uuid.uuid4()), "document_name": "SOP-1.pdf"}],
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    assert response_with_docs.affected_documents_count == 1


def test_assess_auto_closes_when_no_affected_documents(db_session):
    org_id, reg = _seed_org_and_regulation(db_session)
    assessment = _make_assessment(reg, org_id, [])

    with patch(
        "app.api.v1.endpoints.impact.assess_compliance_impact",
        return_value=assessment,
    ), patch("app.core.audit.add_audit_event") as mock_audit:
        result = impact_endpoint.trigger_impact_assessment(
            regulation_id=reg.id,
            db=db_session,
            tenant_id=DEFAULT_ORG_ID,
        )

    db_session.refresh(reg)
    assert result is assessment
    assert reg.status == "Closed"
    audit_types = [call.args[2] for call in mock_audit.call_args_list]
    assert "impact_assessment_completed" in audit_types
    assert "case_closed" in audit_types
    closed_msg = next(
        call.args[3] for call in mock_audit.call_args_list if call.args[2] == "case_closed"
    )
    assert "no company documents affected" in closed_msg.lower()


def test_assess_keeps_complete_status_when_documents_affected(db_session):
    org_id, reg = _seed_org_and_regulation(db_session)
    assessment = _make_assessment(
        reg,
        org_id,
        [{
            "document_id": str(uuid.uuid4()),
            "document_name": "SOP-Access.pdf",
            "document_type": "SOP",
            "affected_sections": "Section 4",
            "explanation": "Access control gap",
            "confidence_score": 88.0,
        }],
    )

    with patch(
        "app.api.v1.endpoints.impact.assess_compliance_impact",
        return_value=assessment,
    ), patch("app.core.audit.add_audit_event") as mock_audit:
        impact_endpoint.trigger_impact_assessment(
            regulation_id=reg.id,
            db=db_session,
            tenant_id=DEFAULT_ORG_ID,
        )

    db_session.refresh(reg)
    assert reg.status == "Impact Assessment Complete"
    audit_types = [call.args[2] for call in mock_audit.call_args_list]
    assert "documents_identified" in audit_types
    assert "case_closed" not in audit_types


def test_remediation_rejected_when_no_affected_documents(db_session):
    org_id, reg = _seed_org_and_regulation(db_session, status="Closed")
    assessment = _make_assessment(reg, org_id, [])
    db_session.add(assessment)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        remediation_endpoint.trigger_remediation_drafts(
            regulation_id=reg.id,
            payload=None,
            db=db_session,
            tenant_id=DEFAULT_ORG_ID,
        )

    assert exc_info.value.status_code == 400
    assert "no company documents are affected" in exc_info.value.detail.lower()
