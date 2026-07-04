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

## Affected Files
- [remediation_agent.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/ai/agents/remediation_agent.py)
- [remediation.md](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/ai/prompts/remediation.md)
- [kb_search_tool.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/ai/tools/kb_search_tool.py)
- [citation_tool.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/ai/tools/citation_tool.py)
- [remediation_draft.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/models/remediation_draft.py)
- [remediation.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/api/v1/endpoints/remediation.py)
- [RedlineDiffViewer.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/components/remediation/RedlineDiffViewer.tsx)
- [CitationTooltip.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/components/remediation/CitationTooltip.tsx)

## Dependencies
- EPIC-01-STORY-1.1 (Document Store/RAG Setup)
- EPIC-04-STORY-4.1 (Impact Assessment Details)
