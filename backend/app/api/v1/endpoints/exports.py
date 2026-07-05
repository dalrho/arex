import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from app.core.dependencies import get_db, get_tenant_id
from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.models.regulation_update import RegulationUpdate
from app.services.export.export_service import generate_pdf_report

router = APIRouter()

@router.get("/remediation/{remediation_id}/pdf")
def export_remediation_pdf(
    remediation_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any if "Any" in globals() else StreamingResponse:
    """
    Exports the additions and deletions of a remediation draft into a formatted PDF document.
    """
    org_id = uuid.UUID(tenant_id)

    draft = db.query(RemediationDraft).join(Document).filter(
        RemediationDraft.id == remediation_id,
        Document.organization_id == org_id
    ).first()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remediation draft not found"
        )

    doc = db.query(Document).filter(Document.id == draft.document_id).first()
    reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == draft.regulation_id).first()

    if not doc or not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated document or regulation not found"
        )

    # Generate PDF
    pdf_bytes = generate_pdf_report(draft, doc, reg)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Remediation_Report_{doc.filename.replace('.txt', '')}.pdf"}
    )
