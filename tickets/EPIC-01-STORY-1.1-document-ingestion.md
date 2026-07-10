# [EPIC-01-STORY-1.1] Organization Setup & Document Ingestion - Upload SOPs, Validation Plans, and Policies

**Epic:** EPIC 1 — Organization Setup & Document Ingestion
**User Story:** As a QA Manager, I want to upload SOPs, validation plans, and policies so the system can assess them against future regulations.

## Description
This ticket represents the implementation work for the user story in **EPIC 1 — Organization Setup & Document Ingestion**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] API contract `POST /v1/documents`, `GET /v1/documents`, `GET /v1/documents/{id}` defined in `shared/openapi/arex.yaml`.
- [ ] Ingestion pipeline parses documents (text extraction with PyMuPDF/pdfplumber).
- [ ] Chunking strategy & `embedding_service` integration (BGE-M3/BGE-large) implemented.
- [ ] Metadata (doc type, department, version) upserted to Qdrant client.
- [ ] UI `DocumentUploader.tsx` with drag-drop, progress, and validation errors.
- [ ] Document list and detail UI with version badge.
- [ ] Integration test verifies upload -> parse -> embed -> retrieve workflow.
- [ ] Per-org data isolation and file type filtering/malware scan hooks verified.
- [ ] Raw PDF/document storage configured (using a shared Docker volume under `/app/storage` or database storage) to support UI redlining and exporting.

## Technical Tasks
- [ ] Define API contract in `shared/openapi/arex.yaml` for documents endpoints
- [ ] Implement `backend/app/services/regulation_parser/pdf_parser.py`
- [ ] Implement chunking strategy & embedding service in `backend/app/services/embeddings/embedding_service.py`
- [ ] Implement `backend/app/services/vector_db/qdrant_client.py` for document indexing
- [ ] Implement DB models and schemas for documents (`backend/app/models/document.py`, `backend/app/api/v1/schemas/document.py`), including defining raw file storage paths and file system persistence
- [ ] Implement backend API endpoints in `backend/app/api/v1/endpoints/documents.py`
- [ ] Build `DocumentUploader.tsx` in frontend components
- [ ] Build document pages in `frontend/src/app/(dashboard)/documents/`
- [ ] Write unit and integration tests for document ingestion


## Collaborative Roles
*   **Backend Developer (Lead):** Design the database schema for the `documents` table. Build `POST /v1/documents` and `GET /v1/documents/{id}`. Implement local file persistence to a shared directory `/app/storage` mapped to a Docker volume.
*   **AI/Data Engineer:** Build the PDF parsing parser (`pdf_parser.py`) and chunking logic. Integrate the embedding service to convert chunks to vectors using the `BGE-large` model and index them into Qdrant.
*   **Frontend Developer:** Build the `DocumentUploader.tsx` component with drag-and-drop support, upload progress animation, and client-side MIME-type checks (PDF only).

## Integration Contract
*   **Postgres Model (`Document`):**
    ```python
    id: UUID (Primary Key)
    organization_id: UUID (Foreign Key)
    filename: str
    file_path: str  # Path to local raw PDF, e.g., /app/storage/UUID.pdf
    parsed_text: str  # Stored text representation for fallback searches
    version: int (default=1)
    created_at: datetime
    ```
*   **Qdrant Payload Schema:**
    ```json
    {
      "vector": [1024 floats],
      "payload": {
        "document_id": "UUID",
        "organization_id": "UUID",
        "chunk_index": 0,
        "text": "Extracted chunk content..."
      }
    }
    ```

## Junior Developer Tips & Pitfalls
1.  **File Name Safety:** Never trust user-provided filenames directly. They can contain directory traversal attacks (e.g. `../../etc/passwd`). Generate a unique UUID for the filename on disk and store the original filename in the database metadata.
2.  **Scanned PDFs:** Simple text extraction fails on scanned PDFs. Check if extracted text length is less than 50 characters, and log a warning or return a notification to the user suggesting OCR ingestion.
3.  **FastAPI Upload Limit:** Limit uploads to 10MB using middleware or route checks to prevent server denial-of-service.
\n## Affected Files
- [shared/openapi/arex.yaml](shared/openapi/arex.yaml)
- [backend/app/services/regulation_parser/pdf_parser.py](backend/app/services/regulation_parser/pdf_parser.py)
- [backend/app/services/embeddings/embedding_service.py](backend/app/services/embeddings/embedding_service.py)
- [backend/app/services/vector_db/qdrant_client.py](backend/app/services/vector_db/qdrant_client.py)
- [backend/app/models/document.py](backend/app/models/document.py)
- [backend/app/api/v1/schemas/document.py](backend/app/api/v1/schemas/document.py)
- [backend/app/api/v1/endpoints/documents.py](backend/app/api/v1/endpoints/documents.py)
- [frontend/src/components/documents/DocumentUploader.tsx](frontend/src/components/documents/DocumentUploader.tsx)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/documents/page.tsx)

## Dependencies
- EPIC-11-STORY-11.1 (DevOps & Environment setup)
