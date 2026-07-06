import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT

from app.models.remediation_draft import RemediationDraft
from app.models.document import Document
from app.models.regulation_update import RegulationUpdate

def generate_pdf_report(draft: RemediationDraft, doc: Document, reg: RegulationUpdate) -> bytes:
    """
    Generates a PDF document with additions/deletions highlighting using ReportLab.
    """
    buffer = io.BytesIO()
    
    # Page setup
    pdf = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Premium theme colors
    title_style = ParagraphStyle(
        name="DocTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1A365D"), # Deep blue
        alignment=TA_LEFT,
        spaceAfter=15
    )
    
    heading_style = ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2B6CB0"), # Slate blue
        spaceBefore=15,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        name="MetaBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2D3748") # Charcoal
    )
    
    added_style = ParagraphStyle(
        name="AddedLine",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2F855A") # Forest green
    )
    
    removed_style = ParagraphStyle(
        name="RemovedLine",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#C53030") # Crimson red
    )

    story = []
    
    # Title
    story.append(Paragraph("SENTINEL OS - REGULATORY COMPLIANCE EXPORT", title_style))
    story.append(Spacer(1, 10))
    
    # Status formatting
    status_color = "#2F855A" if draft.status == "APPROVED" else "#C53030"
    status_text = f"<font color='{status_color}'><b>{draft.status}</b></font>"
    
    # Metadata table
    data = [
        [Paragraph("<b>Source SOP Document:</b>", body_style), Paragraph(doc.filename, body_style)],
        [Paragraph("<b>Active SOP Version:</b>", body_style), Paragraph(f"v{doc.version}", body_style)],
        [Paragraph("<b>FDA Regulation Title:</b>", body_style), Paragraph(reg.title, body_style)],
        [Paragraph("<b>Remediation Status:</b>", body_style), Paragraph(status_text, body_style)],
        [Paragraph("<b>Exported At:</b>", body_style), Paragraph(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), body_style)]
    ]
    
    meta_table = Table(data, colWidths=[150, 350])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E0")),
    ]))
    
    story.append(meta_table)
    story.append(Spacer(1, 20))
    
    # Additions
    story.append(Paragraph("PROPOSED COMPLIANCE ADDITIONS (+)", heading_style))
    added_lines = draft.diff_content.get("added", []) if draft.diff_content else []
    if not added_lines:
        story.append(Paragraph("No direct additions proposed.", body_style))
    else:
        for line in added_lines:
            story.append(Paragraph(f"+ {line}", added_style))
            story.append(Spacer(1, 3))
            
    story.append(Spacer(1, 15))
    
    # Deletions
    story.append(Paragraph("PROPOSED COMPLIANCE DELETIONS (-)", heading_style))
    removed_lines = draft.diff_content.get("removed", []) if draft.diff_content else []
    if not removed_lines:
        story.append(Paragraph("No direct deletions proposed.", body_style))
    else:
        for line in removed_lines:
            story.append(Paragraph(f"- {line}", removed_style))
            story.append(Spacer(1, 3))
            
    pdf.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
