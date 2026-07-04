# [EPIC-04-STORY-4.1] Compliance Impact Engine - Document Mapping & Risk Scoring

**Epic:** EPIC 4 — Compliance Impact Engine (Deterministic + Retrieval)
**User Story:** As a QA Manager, I want to see exactly which SOPs and departments are impacted by a relevant update.

## Description
This ticket represents the implementation work for the user story in **EPIC 4 — Compliance Impact Engine (Deterministic + Retrieval)**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] `impact_engine.py` queries Qdrant with regulation embedding to retrieve affected documents above threshold.
- [ ] `risk_rules.py` computes deterministic risk score using predefined business rules.
- [ ] API contract `GET /v1/impact/{regulation_id}` returns mapping, priorities, and scores.
- [ ] UI displays `ImpactSummaryCard.tsx` and `RiskBadge.tsx` on dashboard.
- [ ] Retrieval thresholds tuned and documented in ADR.

## Technical Tasks
- [ ] Implement semantic matching logic in `backend/app/services/compliance_impact/impact_engine.py`
- [ ] Implement risk calculation rules in `backend/app/services/risk_scoring/risk_rules.py`
- [ ] Define DB models and schema for `impact_assessment`
- [ ] Implement API endpoint `/v1/impact/{regulation_id}` in backend
- [ ] Build `ImpactSummaryCard.tsx` and `RiskBadge.tsx` in frontend components
- [ ] Write integration tests verifying correct matching of seeded documents

## Affected Files
- [impact_engine.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/compliance_impact/impact_engine.py)
- [risk_rules.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/risk_scoring/risk_rules.py)
- [impact_assessment.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/models/impact_assessment.py)
- [impact.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/api/v1/endpoints/impact.py)
- [ImpactSummaryCard.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/components/dashboard/ImpactSummaryCard.tsx)
- [RiskBadge.tsx](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/frontend/src/components/dashboard/RiskBadge.tsx)

## Dependencies
- EPIC-01-STORY-1.1 (Document Ingestion)
- EPIC-03-STORY-3.1 (Regulatory Classification)
