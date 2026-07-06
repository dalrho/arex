import pytest
from unittest.mock import patch, MagicMock
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
from app.services.fda_monitoring.poller import poll_fda_regulations

@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

@patch("app.services.fda_monitoring.poller.httpx.get")
@patch("app.services.fda_monitoring.poller.time.sleep", return_value=None)
def test_poll_fda_regulations(mock_sleep, mock_get, db_session):
    # Mocking Federal Register API calls
    mock_list_response = MagicMock()
    mock_list_response.status_code = 200
    mock_list_response.json.return_value = {
        "results": [
            {
                "html_url": "https://example.com/fda-doc",
                "title": "Test FDA Guidance Notice",
                "publication_date": "2026-07-06",
                "document_number": "2026-99999"
            }
        ]
    }

    mock_detail_response = MagicMock()
    mock_detail_response.status_code = 200
    mock_detail_response.json.return_value = {
        "body_html_url": "https://example.com/fda-doc-body.html",
        "abstract": "Test abstract description."
    }

    mock_html_response = MagicMock()
    mock_html_response.status_code = 200
    mock_html_response.text = "<html><body><h1>FDA Rules on SOPs</h1><p>Compliance is mandatory.</p></body></html>"

    # Side effect for the three httpx.get requests
    mock_get.side_effect = [
        mock_list_response,
        mock_detail_response,
        mock_html_response
    ]

    # Run the poller
    new_count = poll_fda_regulations(db_session, limit=1)
    assert new_count == 1

    # Check database persistence
    reg = db_session.query(RegulationUpdate).first()
    assert reg is not None
    assert reg.title == "Test FDA Guidance Notice"
    assert reg.source_url == "https://example.com/fda-doc"
    assert "FDA Rules on SOPs" in reg.raw_content
    # HTML tags should be stripped
    assert "<html>" not in reg.raw_content

    # Run again with same mock list response to test URL duplicate detection
    mock_get.side_effect = [mock_list_response]
    second_count = poll_fda_regulations(db_session, limit=1)
    assert second_count == 0
