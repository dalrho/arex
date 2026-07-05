# [EPIC-03-STORY-3.1] Regulatory Intelligence Agent - AI Classification & Urgency Assessment

**Epic:** EPIC 3 — Regulatory Intelligence Agent (AI)
**User Story:** As a QA Manager, I want the system to tell me whether a new regulation actually affects us before I invest review time.

## Description
This ticket represents the implementation work for the user story in **EPIC 3 — Regulatory Intelligence Agent (AI)**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] Structured agent output schema (`relevant: bool`, `category`, `urgency`, `affected_business_areas[]`, `rationale`) defined.
- [ ] System prompt version-controlled in `prompts/regulatory_intelligence.md`.
- [ ] LangGraph agent node `regulatory_intelligence_agent.py` processes updates and validates output structure using Pydantic.
- [ ] Agent integrated into LangGraph routing flow with conditional edge (non-relevant terminates flow).
- [ ] API `GET /v1/regulations/{id}` serves agent verdicts.
- [ ] UI displays relevance badge, urgency, and agent rationale in regulation feed item.
- [ ] Golden-set evaluation tool verifies agent accuracy against 15-20 test cases.

## Technical Tasks
- [ ] Create validation schema for agent output in `backend/app/api/v1/schemas/regulation.py`
- [ ] Write prompt markdown in `backend/app/ai/prompts/regulatory_intelligence.md`
- [ ] Implement `backend/app/ai/agents/regulatory_intelligence_agent.py` using LangGraph
- [ ] Configure conditional routing edge and LangGraph state checkpointer (e.g., using `SqliteSaver` or Postgres/Alembic integrations) in `backend/app/ai/graph_builder.py` to persist agent execution states
- [ ] Implement backend endpoint `/v1/regulations/{id}`
- [ ] Build feed item UI with relevance and urgency badges in frontend
- [ ] Write evaluation script to test prompt against historical dataset


## Collaborative Roles
*   **AI Developer (Lead):** Write the LangGraph node `regulatory_intelligence_agent.py`. Structure LLM inputs and configure Pydantic schemas for output validation. Write prompt templates inside `regulatory_intelligence.md`.
*   **Backend Developer:** Build endpoint `GET /v1/regulations/{id}` to serve agent classifications. Connect LangGraph states to SQLite or Postgres checkpointers.
*   **Frontend Developer:** Design the dashboard regulation feed item showing relevance, urgency badges, and formatting the LLM-generated rationale Markdown.

## Integration Contract
*   **LangGraph Checkpoint Database:** Use `SqliteSaver` in development (configured in `graph_builder.py`) to serialize execution state.
*   **Pydantic Agent Output Schema:**
    ```python
    class RegulatoryIntelligenceOutput(BaseModel):
        relevant: bool
        category: str  # Enum: "records", "validation", "signatures", "other"
        urgency: str  # Enum: "low", "medium", "high", "critical"
        affected_business_areas: List[str]
        rationale: str  # Markdown text explaining decision
    ```

## Junior Developer Tips & Pitfalls
1.  **Output Parsing Resilience:** LLMs can occasionally return unparseable JSON or text block wrappers. Use a Pydantic output parser wrapper and implement a retry mechanism (up to 2 attempts) requesting the LLM to format correctly.
2.  **Logging Cost & Token Usage:** Always capture input/output token counts, model latency, and cost per invocation. Write these metrics to log outputs to monitor API consumption.
\n## Affected Files
- [backend/app/ai/agents/regulatory_intelligence_agent.py](backend/app/ai/agents/regulatory_intelligence_agent.py)
- [backend/app/ai/prompts/regulatory_intelligence.md](backend/app/ai/prompts/regulatory_intelligence.md)
- [backend/app/ai/graph_builder.py](backend/app/ai/graph_builder.py)
- [backend/app/api/v1/endpoints/regulations.py](backend/app/api/v1/endpoints/regulations.py)
- [frontend/src/components/dashboard/RegulationFeedItem.tsx](frontend/src/components/dashboard/RegulationFeedItem.tsx)

## Dependencies
- EPIC-02-STORY-2.1 (Regulation Persistence)
- EPIC-11-STORY-11.1 (LLM/Inference Config)
