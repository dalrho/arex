# [EPIC-01-STORY-1.2] Document Ingestion - Versioning & Supersede Logic

**Epic:** EPIC 1 — Organization Setup & Document Ingestion
**User Story:** As a Quality Systems Administrator, I want document versioning so I know which revision is currently in effect.

## Description
This ticket represents the implementation work for the user story in **EPIC 1 — Organization Setup & Document Ingestion**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] Backend document model stores version identifiers and implements supersede logic.
- [ ] Frontend document details page renders version diff indicator showing current revision.

## Technical Tasks
- [ ] Add `version` and `superseded_by` fields in `backend/app/models/document.py`
- [ ] Implement supersede logic in backend services when a new version of an existing document is uploaded
- [ ] Implement version diff indicator component in frontend
- [ ] Update document detail page to display version history


## Collaborative Roles
*   **Backend Developer (Lead):** Extend the `documents` database table. Implement the supersede database logic: when a new version is uploaded, mark the previous document as superseded in a single transaction.
*   **Frontend Developer:** Build a version timeline component showing historical revisions on the document details page and add a visual diff indicator if the document is not the latest active version.

## Integration Contract
*   **Postgres Model Extensions:**
    ```python
    superseded_by: UUID (Foreign Key referencing Document.id, nullable)
    status: str  # Enum: "active" | "superseded"
    ```
*   **Supersede Transaction Sequence:**
    1. Check for existing active documents with matching name and organization ID.
    2. Start transaction.
    3. Insert new document record with `version = previous.version + 1` and `status = "active"`.
    4. Update old document record setting `status = "superseded"` and `superseded_by = new_doc.id`.
    5. Commit transaction.

## Junior Developer Tips & Pitfalls
1.  **Transaction Safety:** Ensure the update of the old document and insert of the new document are atomic. If step 4 fails, step 3 must be rolled back.
2.  **Circular References:** Verify the database model does not allow a document to supersede itself or reference a circular chain of versions.
\n## Affected Files
- [backend/app/models/document.py](backend/app/models/document.py)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/documents/[id]/page.tsx)
- [frontend/src/components/documents/DocumentVersionTag.tsx](frontend/src/components/documents/DocumentVersionTag.tsx)

## Dependencies
- EPIC-01-STORY-1.1 (Base Document Ingestion)
