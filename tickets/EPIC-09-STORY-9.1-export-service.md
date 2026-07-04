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
- [ ] Implement PDF generator service in `backend/app/services/export/pdf_exporter.py`
- [ ] Implement Docx generator service in `backend/app/services/export/docx_exporter.py`
- [ ] Add template files to `backend/app/services/export/report_templates/`
- [ ] Build Export component/page in `frontend/src/app/(dashboard)/exports/page.tsx`
- [ ] Write tests checking that unapproved drafts throw errors during export generation

## Affected Files
- [pdf_exporter.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/export/pdf_exporter.py)
- [docx_exporter.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/export/docx_exporter.py)
- [exports.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/api/v1/endpoints/exports.py)
- [page.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/app/(dashboard)/exports/page.tsx)

## Dependencies
- EPIC-08-STORY-8.1 (Human Approval workflow)
