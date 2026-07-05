import fitz
from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.models.regulation_update import RegulationUpdate

def generate_pdf_report(draft: RemediationDraft, doc: Document, reg: RegulationUpdate) -> bytes:
    """
    Generates a PDF document with additions/deletions highlighting using PyMuPDF.
    """
    pdf = fitz.open()
    page = pdf.new_page(width=595, height=842)  # A4 size

    # Header Title
    page.insert_text(
        (50, 50),
        "SENTINEL OS - REGULATORY COMPLIANCE EXPORT",
        fontsize=14,
        fontname="helvetica-bold",
        color=(0.1, 0.3, 0.6)
    )

    y = 80
    page.insert_text((50, y), f"Source SOP Document: {doc.filename}", fontsize=10, fontname="helvetica-bold")
    page.insert_text((350, y), f"Active SOP Version: v{doc.version}", fontsize=10, fontname="helvetica")

    y += 18
    page.insert_text((50, y), f"FDA Regulation Title: {reg.title}", fontsize=10, fontname="helvetica-bold")
    
    status_color = (0, 0.6, 0.1) if draft.status == "APPROVED" else (0.8, 0.1, 0.1)
    page.insert_text((350, y), f"Remediation Status: {draft.status}", fontsize=10, fontname="helvetica-bold", color=status_color)

    y += 15
    page.draw_line((50, y), (545, y), color=(0.7, 0.7, 0.7), width=1)

    # 1. Proposed Additions Section
    y += 30
    page.insert_text((50, y), "PROPOSED COMPLIANCE ADDITIONS (+)", fontsize=11, fontname="helvetica-bold", color=(0, 0.5, 0.1))

    added_lines = draft.diff_content.get("added", []) if draft.diff_content else []
    if not added_lines:
        y += 20
        page.insert_text((50, y), "No direct additions proposed.", fontsize=9, fontname="helvetica", color=(0.5, 0.5, 0.5))
    else:
        for line in added_lines:
            y += 20
            wrapped_text = f"+ {line}"
            if len(wrapped_text) > 85:
                wrapped_text = wrapped_text[:82] + "..."
            page.insert_text((50, y), wrapped_text, fontsize=9, fontname="helvetica", color=(0, 0.5, 0.1))
            if y > 780:
                page = pdf.new_page(width=595, height=842)
                y = 50

    # 2. Proposed Deletions Section
    y += 40
    if y > 750:
        page = pdf.new_page(width=595, height=842)
        y = 50
    page.insert_text((50, y), "PROPOSED COMPLIANCE DELETIONS (-)", fontsize=11, fontname="helvetica-bold", color=(0.8, 0.1, 0.1))

    removed_lines = draft.diff_content.get("removed", []) if draft.diff_content else []
    if not removed_lines:
        y += 20
        page.insert_text((50, y), "No direct deletions proposed.", fontsize=9, fontname="helvetica", color=(0.5, 0.5, 0.5))
    else:
        for line in removed_lines:
            y += 20
            wrapped_text = f"- {line}"
            if len(wrapped_text) > 85:
                wrapped_text = wrapped_text[:82] + "..."
            page.insert_text((50, y), wrapped_text, fontsize=9, fontname="helvetica", color=(0.8, 0.1, 0.1))
            if y > 780:
                page = pdf.new_page(width=595, height=842)
                y = 50

    pdf_bytes = pdf.write()
    pdf.close()
    return pdf_bytes
