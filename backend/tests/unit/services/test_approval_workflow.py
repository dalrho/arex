import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.user import User
from app.models.organization import Organization
from app.models.document import Document
from app.models.regulation_update import RegulationUpdate
from app.models.remediation_draft import RemediationDraft
from app.models.approval_record import ApprovalRecord
from app.models.impact_assessment import ImpactAssessment
from app.models.implementation_task import ImplementationTask
from app.services.approval_workflow.workflow_state_machine import WorkflowStateMachine

# In-memory SQLite for quick validation tests
@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    # Import User first to ensure 'users' table is registered in Base metadata
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_workflow_state_machine_transitions():
    # Valid transitions
    WorkflowStateMachine.validate_transition("PENDING_REVIEW", "APPROVED")
    WorkflowStateMachine.validate_transition("PENDING_REVIEW", "REJECTED")
    WorkflowStateMachine.validate_transition("PENDING_REVIEW", "PENDING_REVIEW")
    WorkflowStateMachine.validate_transition("REJECTED", "PENDING_REVIEW")  # Reset

    # Invalid transitions
    with pytest.raises(ValueError, match="already 'APPROVED' and cannot be transitioned"):
        WorkflowStateMachine.validate_transition("APPROVED", "PENDING_REVIEW")

    with pytest.raises(ValueError, match="already 'APPROVED' and cannot be transitioned"):
        WorkflowStateMachine.validate_transition("APPROVED", "REJECTED")

    with pytest.raises(ValueError, match="cannot transition directly"):
        WorkflowStateMachine.validate_transition("REJECTED", "APPROVED")


def test_workflow_state_machine_edits():
    # Editable
    WorkflowStateMachine.validate_edit("PENDING_REVIEW")

    # Non-editable
    with pytest.raises(ValueError, match="Draft cannot be modified"):
        WorkflowStateMachine.validate_edit("APPROVED")

    with pytest.raises(ValueError, match="Draft cannot be modified"):
        WorkflowStateMachine.validate_edit("REJECTED")

def test_approval_record_immutability(db_session):
    record = ApprovalRecord(
        id=uuid.uuid4(),
        item_type="remediation_draft",
        item_id=uuid.uuid4(),
        status="APPROVED",
        reviewer_id=uuid.uuid4(),
        timestamp=datetime.now(timezone.utc),
        original_content={"text": "orig"},
        final_content={"text": "final"}
    )
    db_session.add(record)
    db_session.commit()

    # Attempt update
    record.status = "REJECTED"
    with pytest.raises(ValueError, match="Approval records are immutable and cannot be updated"):
        db_session.commit()

    db_session.rollback()

    # Attempt delete
    db_session.delete(record)
    with pytest.raises(ValueError, match="Approval records are immutable and cannot be deleted"):
        db_session.commit()
