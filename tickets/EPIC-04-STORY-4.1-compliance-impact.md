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
- [ ] Implement risk calculation rules in `backend/app/services/risk_scoring/risk_rules.py` using a structured scoring matrix (e.g., Risk Score = Urgency * Affected Departments Count * Category Multiplier)
- [ ] Define DB models and schema for `impact_assessment`
- [ ] Implement API endpoint `/v1/impact/{regulation_id}` in backend
- [ ] Build `ImpactSummaryCard.tsx` and `RiskBadge.tsx` in frontend components
- [ ] Write integration tests verifying correct matching of seeded documents


## Collaborative Roles
*   **AI/Data Engineer (Lead):** Write Qdrant semantic query logic in `impact_engine.py` to retrieve internal documents mapping to new regulations. Tune cosine similarity thresholds.
*   **Backend Developer:** Implement deterministic scoring calculations in `risk_rules.py`. Store final evaluation reports in the database.
*   **Frontend Developer:** Build UI widgets `ImpactSummaryCard.tsx` and `RiskBadge.tsx`.

## Integration Contract
*   **Risk Scoring Formula:**
    ```python
    Risk Score = Urgency Multiplier * Department Factor * Category Multiplier
    # Urgency Multiplier: Low=1, Medium=2, High=3, Critical=4
    # Department Factor: count of affected business departments (1 to 5)
    # Category Multiplier: "records"=1.2, "validation"=1.5, "signatures"=1.8, "other"=1.0
    # Final Risk Rank: Score < 3 (Low), 3-6 (Medium), > 6 (High)
    ```
*   **Postgres Model (`ImpactAssessment`):**
    ```python
    id: UUID (Primary key)
    regulation_id: UUID (Foreign key)
    risk_score: float
    risk_rank: str  # Enum: "low", "medium", "high"
    affected_departments: List[str]
    matched_document_ids: List[UUID]  # Mapped company SOPs
    assessment_date: datetime
    ```

## Junior Developer Tips & Pitfalls
1.  **Tuning Semantic Similarity:** A similarity threshold that is too high (e.g. 0.88) will miss critical compliance impacts (false negatives). A threshold too low (e.g. 0.60) will flag irrelevant documents (false positives). Test and set a baseline threshold of `0.75` and log matching scores for debugging.
2.  **No AI for Risk Calculations:** Under FDA guidelines, calculations should be deterministic and audit-traceable. Do not use an LLM to assign the risk score directly; compute it in Python code using standard mathematical formulas.
\n## Affected Files
- [backend/app/services/compliance_impact/impact_engine.py](backend/app/services/compliance_impact/impact_engine.py)
- [backend/app/services/risk_scoring/risk_rules.py](backend/app/services/risk_scoring/risk_rules.py)
- [backend/app/models/impact_assessment.py](backend/app/models/impact_assessment.py)
- [backend/app/api/v1/endpoints/impact.py](backend/app/api/v1/endpoints/impact.py)
- [frontend/src/components/dashboard/ImpactSummaryCard.tsx](frontend/src/components/dashboard/ImpactSummaryCard.tsx)
- [frontend/src/components/dashboard/RiskBadge.tsx](frontend/src/components/dashboard/RiskBadge.tsx)

## Dependencies
- EPIC-01-STORY-1.1 (Document Ingestion)
- EPIC-03-STORY-3.1 (Regulatory Classification)
