# AREX — Project Layout & Task Breakdown
**Prepared as:** Pre-development planning artifact
**Scope:** FDA 21 CFR Part 11 regulatory intelligence MVP (AMD Developer Challenge)

---

## 1. Production-Ready Directory Structure

This is a **monorepo** layout. It keeps the AI orchestration layer (LangGraph agents) architecturally separate from deterministic backend services, per the system architecture diagram, while sharing infra/config at the root. Docker Compose ties everything together for the hackathon deployment target.

```
arex/
├── README.md
├── docker-compose.yml
├── docker-compose.override.yml          # local dev overrides (hot reload, exposed ports)
├── .env.example
├── .gitignore
├── Makefile                              # make up / make seed / make test shortcuts
│
├── docs/
│   ├── architecture/
│   │   ├── system-architecture.md
│   │   ├── data-flow-diagrams/
│   │   └── decision-log.md               # ADRs (Architecture Decision Records)
│   ├── api/
│   │   └── openapi.yaml                  # generated + hand-annotated contract
│   └── compliance/
│       └── 21-cfr-part-11-mapping.md     # traceability: feature -> regulation clause
│
├── infra/
│   ├── docker/
│   │   ├── backend.Dockerfile
│   │   ├── frontend.Dockerfile
│   │   ├── worker.Dockerfile              # for FDA monitoring / async jobs
│   │   └── qdrant/
│   ├── postgres/
│   │   ├── init.sql
│   │   └── migrations/                    # Alembic migration scripts
│   └── scripts/
│       ├── seed_demo_data.py
│       └── health_check.sh
│
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── app/
│   │   ├── main.py                        # FastAPI entrypoint
│   │   ├── core/
│   │   │   ├── config.py                  # env/settings (Pydantic Settings)
│   │   │   ├── security.py                # auth, JWT, RBAC deps
│   │   │   ├── logging.py
│   │   │   └── dependencies.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       ├── endpoints/
│   │   │       │   ├── auth.py
│   │   │       │   ├── organizations.py
│   │   │       │   ├── documents.py       # upload, list, versioning
│   │   │       │   ├── regulations.py     # feed of detected updates
│   │   │       │   ├── impact.py          # impact analysis results
│   │   │       │   ├── remediation.py     # redline drafts
│   │   │       │   ├── tasks.py           # implementation tasks
│   │   │       │   ├── approvals.py       # approve/edit/reject
│   │   │       │   ├── exports.py
│   │   │       │   └── dashboard.py       # aggregated views
│   │   │       └── schemas/               # Pydantic request/response models
│   │   │           ├── document.py
│   │   │           ├── regulation.py
│   │   │           ├── impact.py
│   │   │           ├── remediation.py
│   │   │           ├── task.py
│   │   │           └── approval.py
│   │   ├── models/                        # SQLAlchemy ORM models
│   │   │   ├── organization.py
│   │   │   ├── user.py
│   │   │   ├── document.py
│   │   │   ├── regulation_update.py
│   │   │   ├── impact_assessment.py
│   │   │   ├── remediation_draft.py
│   │   │   ├── implementation_task.py
│   │   │   └── approval_record.py
│   │   ├── services/                      # "Traditional Backend Services" layer
│   │   │   ├── fda_monitoring/
│   │   │   │   ├── poller.py
│   │   │   │   └── source_config.py       # FDA endpoints/RSS/sitemap targets
│   │   │   ├── change_detector/
│   │   │   │   └── diff_engine.py
│   │   │   ├── regulation_parser/
│   │   │   │   ├── pdf_parser.py          # PyMuPDF/pdfplumber
│   │   │   │   └── html_parser.py
│   │   │   ├── knowledge_base/
│   │   │   │   ├── document_store.py
│   │   │   │   └── metadata_manager.py
│   │   │   ├── embeddings/
│   │   │   │   └── embedding_service.py   # BGE-M3 / BGE-large wrapper
│   │   │   ├── vector_db/
│   │   │   │   └── qdrant_client.py
│   │   │   ├── compliance_impact/
│   │   │   │   └── impact_engine.py
│   │   │   ├── risk_scoring/
│   │   │   │   └── risk_rules.py          # deterministic rule set
│   │   │   ├── approval_workflow/
│   │   │   │   └── workflow_state_machine.py
│   │   │   └── export/
│   │   │       ├── pdf_exporter.py
│   │   │       ├── docx_exporter.py
│   │   │       └── report_templates/
│   │   ├── ai/                            # "AI Layer" — LangGraph orchestration
│   │   │   ├── graph_builder.py           # top-level LangGraph wiring
│   │   │   ├── llm_client.py              # Qwen3 8B via ROCm / Fireworks API
│   │   │   ├── agents/
│   │   │   │   ├── regulatory_intelligence_agent.py
│   │   │   │   ├── remediation_agent.py
│   │   │   │   └── implementation_agent.py
│   │   │   ├── prompts/
│   │   │   │   ├── regulatory_intelligence.md
│   │   │   │   ├── remediation.md
│   │   │   │   └── implementation.md
│   │   │   └── tools/                     # agent-callable tools (RAG lookup, etc.)
│   │   │       ├── kb_search_tool.py
│   │   │       └── citation_tool.py
│   │   ├── workers/                       # background/async jobs (Celery/RQ or APScheduler)
│   │   │   ├── celery_app.py
│   │   │   ├── monitoring_job.py
│   │   │   └── embedding_job.py
│   │   └── db/
│   │       ├── session.py
│   │       └── base.py
│   └── tests/
│       ├── unit/
│       │   ├── services/
│       │   └── ai/
│       ├── integration/
│       │   ├── api/
│       │   └── workflow/
│       └── fixtures/
│           └── sample_regulations/
│
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/                           # Next.js app router
│   │   │   ├── layout.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx               # main compliance dashboard
│   │   │   │   ├── documents/
│   │   │   │   │   ├── page.tsx           # KB document list
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── regulations/
│   │   │   │   │   ├── page.tsx           # regulatory update feed
│   │   │   │   │   └── [id]/page.tsx      # detail: impact, agent output
│   │   │   │   ├── remediation/
│   │   │   │   │   └── [id]/page.tsx      # redline review UI
│   │   │   │   ├── tasks/
│   │   │   │   │   └── page.tsx           # implementation task board
│   │   │   │   ├── approvals/
│   │   │   │   │   └── page.tsx           # approve/edit/reject queue
│   │   │   │   └── exports/
│   │   │   │       └── page.tsx
│   │   │   └── api/                       # BFF route handlers if needed
│   │   ├── components/
│   │   │   ├── ui/                        # design-system primitives
│   │   │   ├── dashboard/
│   │   │   │   ├── ImpactSummaryCard.tsx
│   │   │   │   ├── RiskBadge.tsx
│   │   │   │   └── RegulationFeedItem.tsx
│   │   │   ├── documents/
│   │   │   │   ├── DocumentUploader.tsx
│   │   │   │   └── DocumentVersionTag.tsx
│   │   │   ├── remediation/
│   │   │   │   ├── RedlineDiffViewer.tsx
│   │   │   │   └── CitationTooltip.tsx
│   │   │   └── approvals/
│   │   │       └── ApprovalActionBar.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts              # typed fetch wrapper (OpenAPI-generated)
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   │   ├── useRegulations.ts
│   │   │   ├── useImpactAssessment.ts
│   │   │   └── useApprovalQueue.ts
│   │   ├── types/
│   │   │   └── generated/                 # OpenAPI-generated TS types
│   │   └── styles/
│   │       └── globals.css
│   └── tests/
│       ├── unit/
│       └── e2e/                           # Playwright/Cypress
│
└── shared/
    ├── openapi/
    │   └── arex.yaml               # single source of truth for API contract
    └── constants/
        └── regulation_categories.json
```

**Key structural decisions:**
- `backend/app/services/` (deterministic) is physically separated from `backend/app/ai/` (LLM-driven) so the human-approval boundary in the architecture diagram is enforced by code organization, not just convention.
- `shared/openapi/` is the single contract both frontend and backend generate from — prevents drift between the two teams/workstreams.
- `docs/compliance/21-cfr-part-11-mapping.md` exists from day one because this is a compliance product; every feature should be traceable to a clause.

---

## 2. Feature-by-Feature Task Breakdown (Agile Backlog)

### EPIC 1 — Organization Setup & Document Ingestion
**Goal:** QA Manager can upload QMS documents and have them searchable in the knowledge base.

- **User Story 1.1:** *As a QA Manager, I want to upload SOPs, validation plans, and policies so the system can assess them against future regulations.*
  - Define API contract: `POST /v1/documents`, `GET /v1/documents`, `GET /v1/documents/{id}` (request/response schemas, file size limits, allowed MIME types) — document in `shared/openapi/arex.yaml`.
  - Build backend `regulation_parser`-style ingestion pipeline for company docs (PyMuPDF/pdfplumber text extraction).
  - Implement chunking strategy + `embedding_service` integration (BGE-M3/BGE-large).
  - Implement `qdrant_client` upsert logic with metadata (doc type, department, version).
  - Build `DocumentUploader.tsx` UI (drag-drop, progress, validation errors).
  - Build document list/detail UI with version history badge.
  - Integration test: upload → parse → embed → retrievable via semantic search.
  - Security: file-type allow-listing, virus/malware scan hook, per-org data isolation (row-level security or tenant_id scoping in Postgres + Qdrant collection-per-org).
  - Test: unit tests for parser edge cases (scanned PDFs, malformed docs).

- **User Story 1.2:** *As a Quality Systems Administrator, I want document versioning so I know which revision is currently in effect.*
  - Backend: version field + supersede logic in `document.py` model.
  - UI: version diff indicator on document detail page.

---

### EPIC 2 — Regulatory Monitoring (Deterministic)
**Goal:** System detects new/updated FDA 21 CFR Part 11 guidance without manual polling.

- **User Story 2.1:** *As the system, I want to continuously poll FDA sources so new guidance is captured automatically.*
  - Define target FDA sources (Federal Register API, FDA.gov guidance pages) in `source_config.py`.
  - Implement `fda_monitoring/poller.py` as a scheduled worker job (APScheduler/Celery beat).
  - Implement `change_detector/diff_engine.py` (hash comparison + structured diff of parsed text).
  - Persist `regulation_update` records with raw + parsed content and diff metadata.
  - Technical sub-task: rate-limiting / backoff strategy for external polling; dead-letter handling for failed fetches.
  - Test: mock FDA responses, verify duplicate detection (same doc shouldn't re-trigger workflow).

---

### EPIC 3 — Regulatory Intelligence Agent (AI)
**Goal:** AI classifies relevance, category, urgency of a detected update.

- **User Story 3.1:** *As a QA Manager, I want the system to tell me whether a new regulation actually affects us before I invest review time.*
  - Define agent I/O contract (structured output schema: `relevant: bool`, `category`, `urgency`, `affected_business_areas[]`, `rationale`).
  - Author and version-control prompt in `prompts/regulatory_intelligence.md`.
  - Implement `regulatory_intelligence_agent.py` as a LangGraph node with structured-output parsing + validation (Pydantic).
  - Wire node into `graph_builder.py`; define conditional edge (irrelevant → terminate workflow).
  - API: `GET /v1/regulations/{id}` returns agent verdict + rationale for UI display.
  - UI: regulation feed item showing relevance badge, urgency, one-line rationale.
  - Testing: golden-set evaluation — curate 15–20 historical 21 CFR Part 11 updates with known relevance labels; measure agent accuracy before trusting it in the pipeline.
  - Security/Guardrail: enforce output schema validation — reject and retry if the LLM returns malformed/unparseable output; never pass unvalidated agent output downstream.

---

### EPIC 4 — Compliance Impact Engine (Deterministic + Retrieval)
**Goal:** Identify which specific company documents and departments are affected.

- **User Story 4.1:** *As a QA Manager, I want to see exactly which SOPs and departments are impacted by a relevant update.*
  - Define `impact_engine.py` semantic search logic (query Qdrant with regulation embedding, threshold + top-k affected docs).
  - Implement `risk_scoring/risk_rules.py` deterministic scoring (business rules, not LLM — per architecture).
  - API contract: `GET /v1/impact/{regulation_id}` → affected docs, departments, priority, risk score.
  - UI: `ImpactSummaryCard.tsx`, `RiskBadge.tsx` on dashboard.
  - Integration test: seeded org documents + mock regulation → verify correct docs surfaced.
  - Sub-task: tune retrieval threshold to avoid false positives/negatives; document tuning rationale in ADR.

---
  
### EPIC 5 — Compliance Dashboard
**Goal:** Central UI for QA Manager to review everything.

- **User Story 5.1:** *As a QA Manager, I want a single dashboard view of regulatory updates, impact, and status.*
  - API: `GET /v1/dashboard` aggregation endpoint (or compose from existing endpoints client-side — decide via ADR).
  - UI layout: dashboard shell (`(dashboard)/layout.tsx`) with nav to Documents, Regulations, Tasks, Approvals, Exports.
  - UI: regulatory feed list with filter (status, urgency, date).
  - UI: empty/loading/error states for each panel.
  - Accessibility pass (keyboard nav, ARIA labels) — QA tooling used by regulated industry, don't skip this.
  - E2E test: seed data → login → dashboard renders all panels correctly.

---

### EPIC 6 — Remediation Agent (AI)
**Goal:** Draft compliant document revisions with citations.

- **User Story 6.1:** *As a QA Manager, I want AI-drafted redlines for affected SOPs so I don't start from a blank page.*
  - Define agent I/O contract: input = affected doc + regulation text; output = `revised_sections[]`, `rationale`, `citations[]`.
  - Implement `remediation_agent.py`, retrieval-augmented via `kb_search_tool.py` (must ground in actual document text, not hallucinate).
  - Implement `citation_tool.py` to force citation of specific regulation clauses.
  - API: `POST /v1/remediation/{regulation_id}` triggers draft generation; `GET /v1/remediation/{id}` fetches result.
  - UI: `RedlineDiffViewer.tsx` (side-by-side or inline diff, per-change accept/reject), `CitationTooltip.tsx`.
  - Testing: verify every generated change includes a citation; flag/block drafts with uncited changes (hard guardrail, not just a UI nicety).
  - Security: treat agent-drafted text as untrusted until human-approved — no auto-write to canonical document store.

---

### EPIC 7 — Implementation Agent (AI)
**Goal:** Convert legal/document changes into cross-functional action items.

- **User Story 7.1:** *As a Validation Engineer, I want concrete tasks generated from a regulation update so my team knows what to build/change.*
  - Define output schema: `task_title`, `department` (enum: Engineering/QA/IT/Training), `description`, `priority`, `source_regulation_id`.
  - Implement `implementation_agent.py`.
  - API: `GET /v1/tasks?regulation_id=`, `PATCH /v1/tasks/{id}` (edit before approval).
  - UI: `tasks/page.tsx` board grouped by department (Kanban-style or simple table for MVP).
  - Test: verify tasks are traceable back to source regulation + remediation draft (audit trail requirement).

---

### EPIC 8 — Human Approval Workflow (Safety-Critical)
**Goal:** No AI output is adopted without explicit human action.

- **User Story 8.1:** *As an authorized reviewer, I want to approve, edit, or reject any AI recommendation before it's considered final.*
  - Define `approval_record` model: `status` (pending/approved/edited/rejected), `reviewer_id`, `timestamp`, `original_content`, `final_content`.
  - Implement `workflow_state_machine.py` — enforce valid transitions only (e.g., can't "approve" something already rejected without re-submission).
  - API: `POST /v1/approvals/{item_id}/decision` with strict RBAC (only authorized roles can approve).
  - UI: `ApprovalActionBar.tsx` on remediation drafts and task lists.
  - **Security/Testing (critical path):**
    - RBAC test: unauthorized user cannot call approval endpoint (403).
    - Immutable audit log — every approval decision is append-only, never overwritten (regulatory requirement: 21 CFR Part 11 itself governs e-signatures/audit trails, so this system must obey the standard it enforces for others).
    - Test that rejected/edited content never silently reaches export without re-approval.

---

### EPIC 9 — Export Service
**Goal:** Approved outputs leave the system as usable artifacts.

- **User Story 9.1:** *As a QA Manager, I want to export approved SOP revisions and reports as PDF/Word.*
  - API: `POST /v1/exports` (type: sop_draft | compliance_report | task_list; format: pdf | docx).
  - Implement `pdf_exporter.py` and `docx_exporter.py` using approved-only content (query must filter `status = approved`).
  - UI: export selection modal + download link.
  - Test: verify exported file only contains approved content, never pending/rejected drafts.

---

### EPIC 10 — Auth, Security & Cross-Cutting Concerns
- **User Story 10.1:** *As an org admin, I want role-based access so only authorized users can approve changes.*
  - Implement JWT auth (`security.py`), roles: QA Manager, Validation Engineer, Regulatory Affairs Specialist, Quality Systems Administrator.
  - Per-organization data isolation (multi-tenant scoping across Postgres + Qdrant).
  - Secrets management: `.env` for local, note migration path to a vault for production.
  - API contract review pass: ensure every endpoint in `openapi.yaml` has documented auth requirements.
  - Load/security test: attempt cross-tenant data access, confirm rejection.
  - Logging/observability: structured logs for every agent invocation (input, output, latency, model version) — needed for audit trail and debugging LLM behavior.

---

### EPIC 11 — DevOps & Environment
- **User Story 11.1:** *As a developer, I want one-command local setup so the whole stack runs consistently.*
  - `docker-compose.yml`: postgres, qdrant, backend, frontend, worker.
  - Alembic migration bootstrap + seed script (`seed_demo_data.py`) with sample org + sample regulation for demo purposes.
  - CI pipeline: lint, unit tests, contract validation (OpenAPI lint), build images.
  - Document AMD ROCm / Fireworks API inference configuration switch (env var to toggle local GPU vs hosted API).

---

## 3. Suggested Implementation Order (Minimizing Blockers)

The guiding principle: **build the deterministic data spine before the AI agents**, because every agent needs real data (documents, embeddings, a regulation record) to operate on — building agents first means mocking everything and re-doing integration later.

1. **Infra & scaffolding** — Docker Compose (Postgres, Qdrant, backend, frontend skeletons), env config, CI shell. *Nothing else can be tested without this.*
2. **API contract first** — Draft `shared/openapi/arex.yaml` for all major resources (documents, regulations, impact, remediation, tasks, approvals) before writing implementation. This lets frontend and backend work in parallel from day one against typed mocks.
3. **Auth & multi-tenancy skeleton** — Get login + org scoping working early since almost every other model hangs off `organization_id` and `user_id`.
4. **Epic 1 (Document Ingestion)** — Upload, parse, embed, index. This is the foundation the Impact Engine and Remediation Agent both depend on.
5. **Epic 2 (Regulatory Monitoring)** — Get real or seeded regulation records into the system (even a manual "ingest this regulation" admin endpoint is fine for MVP before the live poller is finished — unblocks agent work immediately).
6. **Epic 3 (Regulatory Intelligence Agent)** — First AI agent. Can now run against real regulation + org data from steps 4–5.
7. **Epic 4 (Compliance Impact Engine)** — Depends on both the knowledge base (step 4) and a classified regulation (step 6).
8. **Epic 5 (Dashboard)** — Once regulation feed + impact data exist, build the primary UI so stakeholders can see end-to-end value early — this is a strong demo checkpoint.
9. **Epic 8 (Approval Workflow) — build the skeleton now, even before Remediation/Implementation agents exist.** Approval is the safety guardrail; having the state machine and RBAC in place before agents produce content avoids retrofitting approval gates onto already-flowing data.
10. **Epic 6 (Remediation Agent)** — Now that approval gating exists, agent output has somewhere safe to land.
11. **Epic 7 (Implementation Agent)** — Same pattern, same downstream approval gate.
12. **Epic 9 (Export Service)** — Naturally last in the content pipeline; only exports approved content.
13. **Epic 10/11 hardening pass** — Security testing, audit-log immutability verification, load testing, polish — run continuously but do a dedicated hardening sprint before any demo/handoff.

**Parallelization note:** Frontend can start on Documents, Dashboard, and Approval UIs as soon as the OpenAPI contract (step 2) is locked, running against mocked responses — it does not need to wait for backend or AI implementation to catch up.
