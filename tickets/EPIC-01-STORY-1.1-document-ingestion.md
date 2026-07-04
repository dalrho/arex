# [EPIC-01-STORY-1.1] Organization Setup & Document Ingestion - Upload SOPs, Validation Plans, and Policies

**Epic:** EPIC 1 — Organization Setup & Document Ingestion
**User Story:** As a QA Manager, I want to upload SOPs, validation plans, and policies so the system can assess them against future regulations.

## Description
This ticket represents the implementation work for the user story in **EPIC 1 — Organization Setup & Document Ingestion**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] API contract `POST /v1/documents`, `GET /v1/documents`, `GET /v1/documents/{id}` defined in `shared/openapi/sentinel-os.yaml`.
- [ ] Ingestion pipeline parses documents (text extraction with PyMuPDF/pdfplumber).
- [ ] Chunking strategy & `embedding_service` integration (BGE-M3/BGE-large) implemented.
- [ ] Metadata (doc type, department, version) upserted to Qdrant client.
- [ ] UI `DocumentUploader.tsx` with drag-drop, progress, and validation errors.
- [ ] Document list and detail UI with version badge.
- [ ] Integration test verifies upload -> parse -> embed -> retrieve workflow.
- [ ] Per-org data isolation and file type filtering/malware scan hooks verified.

## Technical Tasks
- [ ] Define API contract in `shared/openapi/sentinel-os.yaml` for documents endpoints
- [ ] Implement `backend/app/services/regulation_parser/pdf_parser.py`
- [ ] Implement chunking strategy & embedding service in `backend/app/services/embeddings/embedding_service.py`
- [ ] Implement `backend/app/services/vector_db/qdrant_client.py` for document indexing
- [ ] Implement DB models and schemas for documents (`backend/app/models/document.py`, `backend/app/api/v1/schemas/document.py`)
- [ ] Implement backend API endpoints in `backend/app/api/v1/endpoints/documents.py`
- [ ] Build `DocumentUploader.tsx` in frontend components
- [ ] Build document pages in `frontend/src/app/(dashboard)/documents/`
- [ ] Write unit and integration tests for document ingestion

## Affected Files
- [sentinel-os.yaml](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/shared/openapi/sentinel-os.yaml)
- [pdf_parser.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/regulation_parser/pdf_parser.py)
- [embedding_service.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/embeddings/embedding_service.py)
- [qdrant_client.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/vector_db/qdrant_client.py)
- [document.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/models/document.py)
- [document.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/api/v1/schemas/document.py)
- [documents.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/api/v1/endpoints/documents.py)
- [DocumentUploader.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/components/documents/DocumentUploader.tsx)
- [page.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/app/(dashboard)/documents/page.tsx)

## Dependencies
- EPIC-11-STORY-11.1 (DevOps & Environment setup)
