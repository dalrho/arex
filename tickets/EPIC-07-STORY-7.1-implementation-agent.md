# [EPIC-07-STORY-7.1] Implementation Agent - Automated Task Action Items

**Epic:** EPIC 7 — Implementation Agent (AI)
**User Story:** As a Validation Engineer, I want concrete tasks generated from a regulation update so my team knows what to build/change.

## Description
This ticket represents the implementation work for the user story in **EPIC 7 — Implementation Agent (AI)**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] Output schema includes task title, target department enum (Engineering/QA/IT/Training), description, priority, and source ID.
- [ ] `implementation_agent.py` processes approved changes to identify task items.
- [ ] API supports querying tasks by regulation and updating task state (`PATCH /v1/tasks/{id}`).
- [ ] UI features a department-grouped task board or list.
- [ ] Audit trail trace exists linking tasks back to source regulations and draft remediation.

## Technical Tasks
- [ ] Create prompt templates in `backend/app/ai/prompts/implementation.md`
- [ ] Build LangGraph node `backend/app/ai/agents/implementation_agent.py`
- [ ] Define DB models and schema for `implementation_task` with traceback links
- [ ] Build API endpoints `GET /v1/tasks` and `PATCH /v1/tasks/{id}`
- [ ] Implement Kanban board / list UI in `frontend/src/app/(dashboard)/tasks/page.tsx`
- [ ] Write integration tests checking traceability links from task back to source


## Collaborative Roles
*   **AI Developer (Lead):** Design prompts in `implementation.md` to extract action items from approved document revisions.
*   **Backend Developer:** Design database models and REST endpoints `GET /v1/tasks` and `PATCH /v1/tasks/{id}`.
*   **Frontend Developer:** Build task queue pages and department-based filter cards.

## Integration Contract
*   **Postgres Model (`ImplementationTask`):**
    ```python
    id: UUID (Primary Key)
    organization_id: UUID (Foreign Key)
    remediation_draft_id: UUID (Foreign Key, nullable)
    source_regulation_id: UUID (Foreign Key)
    title: str
    description: str
    department: str  # Enum: "Engineering", "QA", "IT", "Training"
    priority: str  # Enum: "low", "medium", "high"
    status: str  # Enum: "todo", "in_progress", "done"
    created_at: datetime
    ```

## Junior Developer Tips & Pitfalls
1.  **Traceability Links:** An absolute audit trail is a core FDA requirement. Every task record must contain a foreign key relationship linking it directly back to `source_regulation_id` and `remediation_draft_id`.
2.  **Status State Safety:** Restrict task status transitions. Only allow transitions in sequence (e.g. `todo` -> `in_progress` -> `done`), and prevent editing of fields on tasks that are linked to closed/archived regulations.
\n## Affected Files
- [backend/app/ai/agents/implementation_agent.py](backend/app/ai/agents/implementation_agent.py)
- [backend/app/ai/prompts/implementation.md](backend/app/ai/prompts/implementation.md)
- [backend/app/models/implementation_task.py](backend/app/models/implementation_task.py)
- [backend/app/api/v1/endpoints/tasks.py](backend/app/api/v1/endpoints/tasks.py)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/tasks/page.tsx)

## Dependencies
- EPIC-06-STORY-6.1 (Remediation Draft Output)
