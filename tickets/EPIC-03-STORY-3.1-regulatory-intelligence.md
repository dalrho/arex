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
- [ ] Configure conditional routing edge in `backend/app/ai/graph_builder.py`
- [ ] Implement backend endpoint `/v1/regulations/{id}`
- [ ] Build feed item UI with relevance and urgency badges in frontend
- [ ] Write evaluation script to test prompt against historical dataset

## Affected Files
- [regulatory_intelligence_agent.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/ai/agents/regulatory_intelligence_agent.py)
- [regulatory_intelligence.md](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/ai/prompts/regulatory_intelligence.md)
- [graph_builder.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/ai/graph_builder.py)
- [regulations.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/api/v1/endpoints/regulations.py)
- [RegulationFeedItem.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/components/dashboard/RegulationFeedItem.tsx)

## Dependencies
- EPIC-02-STORY-2.1 (Regulation Persistence)
- EPIC-11-STORY-11.1 (LLM/Inference Config)
