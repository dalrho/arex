# [EPIC-06-STORY-6.1] Remediation Agent - AI Redline Generator with Citations

**Epic:** EPIC 6 — Remediation Agent (AI)
**User Story:** As a QA Manager, I want AI-drafted redlines for affected SOPs so I don't start from a blank page.

## Description
This ticket represents the implementation work for the user story in **EPIC 6 — Remediation Agent (AI)**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] Agent input takes doc content and regulation. Output structured as revised sections, rationale, and specific regulation citations.
- [ ] `remediation_agent.py` retrieves reference documents using `kb_search_tool.py` to prevent hallucinated text.
- [ ] `citation_tool.py` enforces linking revisions to exact regulation clauses.
- [ ] Endpoints `POST /v1/remediation/{regulation_id}` and `GET /v1/remediation/{id}` operational.
- [ ] UI `RedlineDiffViewer.tsx` shows side-by-side changes with citation tooltips.
- [ ] System flags or blocks any draft revisions lacking valid citations.
- [ ] Generated drafts treated as untrusted (stored separately, not written directly to main document store).

## Technical Tasks
- [ ] Design prompt templates in `backend/app/ai/prompts/remediation.md`
- [ ] Implement retrieval tool `backend/app/ai/tools/kb_search_tool.py`
- [ ] Implement citation matching tool `backend/app/ai/tools/citation_tool.py`
- [ ] Build `backend/app/ai/agents/remediation_agent.py`
- [ ] Create DB models and API schemas for remediation drafts
- [ ] Build endpoints `POST /v1/remediation/{regulation_id}` and `GET /v1/remediation/{id}`
- [ ] Implement side-by-side UI `RedlineDiffViewer.tsx` and `CitationTooltip.tsx`
- [ ] Add server-side validation to enforce presence of citations in drafts


## Collaborative Roles
*   **AI Developer (Lead):** Write `remediation_agent.py`. Build `kb_search_tool.py` to retrieve raw document sections from Postgres/Qdrant. Write prompts in `remediation.md` that enforce formatting of citations.
*   **Backend Developer:** Create the `remediation_drafts` table. Build `POST /v1/remediation/{regulation_id}` and query routes.
*   **Frontend Developer:** Build `RedlineDiffViewer.tsx` to display inline text comparison highlighting additions and deletions.

## Integration Contract
*   **Postgres Model (`RemediationDraft`):**
    ```python
    id: UUID (Primary Key)
    document_id: UUID (Foreign Key)
    regulation_id: UUID (Foreign Key)
    original_text: str
    suggested_text: str
    citations: List[str]  # e.g., ["Part 11.10(b)", "Part 11.50"]
    rationale: str
    status: str  # Enum: "pending_review" | "approved" | "rejected"
    ```

## Junior Developer Tips & Pitfalls
1.  **AI Output Security Separation:** Never write proposed agent draft revisions directly back into the master `documents` table. Store revisions in the distinct `remediation_drafts` table. This creates a secure boundary protecting canonical company documents from LLM hallucinations until a human reviewer signs off.
2.  **Citation Enforcement:** Validate the structured response returned by the agent. If the citation list is empty or fails to map directly to a regulation section, reject the draft internally and throw a warning or execute a self-correcting prompt retry.
\n## Affected Files
- [backend/app/ai/agents/remediation_agent.py](backend/app/ai/agents/remediation_agent.py)
- [backend/app/ai/prompts/remediation.md](backend/app/ai/prompts/remediation.md)
- [backend/app/ai/tools/kb_search_tool.py](backend/app/ai/tools/kb_search_tool.py)
- [backend/app/ai/tools/citation_tool.py](backend/app/ai/tools/citation_tool.py)
- [backend/app/models/remediation_draft.py](backend/app/models/remediation_draft.py)
- [backend/app/api/v1/endpoints/remediation.py](backend/app/api/v1/endpoints/remediation.py)
- [frontend/src/components/remediation/RedlineDiffViewer.tsx](frontend/src/components/remediation/RedlineDiffViewer.tsx)
- [frontend/src/components/remediation/CitationTooltip.tsx](frontend/src/components/remediation/CitationTooltip.tsx)

## Dependencies
- EPIC-01-STORY-1.1 (Document Store/RAG Setup)
- EPIC-04-STORY-4.1 (Impact Assessment Details)
