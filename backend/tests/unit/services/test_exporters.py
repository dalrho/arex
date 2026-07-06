import pytest
import uuid
from datetime import datetime, timezone

from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.models.regulation_update import RegulationUpdate
from app.models.user import User
from app.models.approval_record import ApprovalRecord
from app.services.export.pdf_exporter import generate_pdf_report
from app.services.export.docx_exporter import generate_docx_report

@pytest.fixture
def sample_models():
    doc = Document(
        id=uuid.uuid4(),
        filename="test_sop.txt",
        file_path="storage/test_sop.txt",
        parsed_text="This is an SOP baseline text.",
        version=1,
        organization_id=uuid.uuid4()
    )
    reg = RegulationUpdate(
        id=uuid.uuid4(),
        source_url="https://example.com/reg",
        title="FDA Guidance 21 CFR Part 11",
        published_date=datetime.now(timezone.utc),
        raw_content="FDA compliance rules",
        hash_value="dummyhash123",
        status="classified"
    )
    draft = RemediationDraft(
        id=uuid.uuid4(),
        document_id=doc.id,
        regulation_id=reg.id,
        proposed_text="This is an SOP baseline text with additions.",
        original_text="This is an SOP baseline text.",
        diff_content={"added": ["with additions."], "removed": []},
        status="APPROVED"
    )
    return draft, doc, reg

def test_pdf_exporter(sample_models):
    draft, doc, reg = sample_models
    pdf_bytes = generate_pdf_report(draft, doc, reg)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0

def test_docx_exporter(sample_models):
    draft, doc, reg = sample_models
    docx_bytes = generate_docx_report(draft, doc, reg)
    assert isinstance(docx_bytes, bytes)
    assert len(docx_bytes) > 0
