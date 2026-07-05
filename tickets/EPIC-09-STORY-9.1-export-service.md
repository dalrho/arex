# [EPIC-09-STORY-9.1] Export Service - Document PDF/Docx Export Generation

**Epic:** EPIC 9 — Export Service
**User Story:** As a QA Manager, I want to export approved SOP revisions and reports as PDF/Word.

## Description
This ticket represents the implementation work for the user story in **EPIC 9 — Export Service**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] API endpoint `POST /v1/exports` accepts item, format, and report type parameters.
- [ ] `pdf_exporter.py` and `docx_exporter.py` generate files.
- [ ] Service queries and processes approved-only content (`status = approved`).
- [ ] UI includes export configuration modal and file download triggers.
- [ ] Test validation verifies that unapproved/pending draft data is never exported.

## Technical Tasks
- [ ] Create export request schema and backend endpoint `/v1/exports`
- [ ] Implement PDF generator service in `backend/app/services/export/pdf_exporter.py` using a headless-compatible library (e.g., `reportlab` or `weasyprint`)
- [ ] Implement Docx generator service in `backend/app/services/export/docx_exporter.py` using `python-docx`
- [ ] Add template files to `backend/app/services/export/report_templates/`
- [ ] Build Export component/page in `frontend/src/app/(dashboard)/exports/page.tsx`
- [ ] Write tests checking that unapproved drafts throw errors during export generation


## Collaborative Roles
*   **Backend Developer (Lead):** Write generation scripts in `pdf_exporter.py` (using `reportlab` or `weasyprint`) and `docx_exporter.py` (using `python-docx`).
*   **Frontend Developer:** Add export selectors and configure file download triggers.

## Integration Contract
*   **Request Schema (`POST /v1/exports`):**
    ```json
    {
      "format": "pdf",  // Enum: "pdf" | "docx"
      "report_type": "sop_revision",  // Enum: "sop_revision" | "compliance_report"
      "target_id": "UUID"
    }
    ```

## Junior Developer Tips & Pitfalls
1.  **Excluding Drafts (Strict Filtering):** Ensure your SQL query explicitly filters `status = 'approved'` when loading text for export compilation. If a draft has a status of `pending_review` or `rejected`, abort the export process immediately and return a `400 Bad Request` explaining that unapproved content cannot be exported.
2.  **Headless Execution:** Make sure your chosen PDF rendering engine runs headless inside Docker. Libraries like PyQT-based converters require graphical servers. Use standard library solutions like `reportlab` or text-to-pdf packages that run natively without GUI dependecies.
\n## Affected Files
- [backend/app/services/export/pdf_exporter.py](backend/app/services/export/pdf_exporter.py)
- [backend/app/services/export/docx_exporter.py](backend/app/services/export/docx_exporter.py)
- [backend/app/api/v1/endpoints/exports.py](backend/app/api/v1/endpoints/exports.py)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/exports/page.tsx)

## Dependencies
- EPIC-08-STORY-8.1 (Human Approval workflow)
