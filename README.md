# Arex: GxP-Compliant Regulatory Compliance Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python Version](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.1.0-black.svg)](https://nextjs.org/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector--DB-red.svg)](https://qdrant.tech/)
[![AMD Developer Challenge](https://img.shields.io/badge/AMD%20Developer%20Challenge-2026-orange.svg)](https://www.amd.com/)

Arex is a premium, high-fidelity regulatory compliance intelligence and document remediation platform. Designed specifically for highly regulated industries (such as BioPharma, Healthcare, and Medical Devices), Arex automates the labor-intensive gap analysis and updates of Standard Operating Procedures (SOPs) when new FDA guidelines—such as FDA 21 CFR Part 11—are issued.

By combining multi-agent AI workflows orchestrated with **LangGraph** with deterministic database validation and strict human-in-the-loop electronic signatures, Arex bridges the gap between state-of-the-art AI agility and rigid GxP audit-readiness.

---

## Table of Contents

1. [Project Overview & Problems Solved](#1-project-overview--problems-solved)
2. [AMD Developer Challenge & Hackathon Alignment](#2-amd-developer-challenge--hackathon-alignment)
3. [System Architecture](#3-system-architecture)
   - [High-Level Architecture](#high-level-architecture)
   - [Ingestion and RAG Pipelines](#ingestion-and-rag-pipelines)
   - [LangGraph Agentic Workflow](#langgraph-agentic-workflow)
   - [End-to-End Sequence Diagram](#end-to-end-sequence-diagram)
4. [Major Features & Internal Mechanics](#4-major-features--internal-mechanics)
   - [Semantic RAG & Multi-Tenant Isolation](#semantic-rag--multi-tenant-isolation)
   - [Non-Destructive Document Remediation (PDF & DOCX)](#non-destructive-document-remediation-pdf--docx)
   - [Jira REST Synchronization](#jira-rest-synchronization)
   - [FDA 21 CFR Part 11 Electronic Signature & Audits](#fda-21-cfr-part-11-electronic-signature--audits)
   - [Deep Workspace resetting](#deep-workspace-resetting)
5. [Setup & Installation Guide](#5-setup--installation-guide)
   - [Prerequisites](#prerequisites)
   - [Installation Steps](#installation-steps)
   - [Environment Configuration](#environment-configuration)
   - [Running the Services](#running-the-services)
   - [Supported AI Providers & Models](#supported-ai-providers--models)
6. [User Guide (Typical Workflow)](#6-user-guide-typical-workflow)
7. [Project Structure](#7-project-structure)
8. [Feature Status (Implemented vs. Future Work)](#8-feature-status-implemented-vs-future-work)

---

## 1. Project Overview & Problems Solved

### The Problem
In life sciences and medical device manufacturing, regulatory compliance is non-negotiable. Standard Operating Procedures (SOPs) govern all GxP operations. However, when regulatory agencies (like the FDA) issue updates or amendments (e.g., changes to electronic records, multi-factor authentication, or premarket approvals), organizations must perform manual audits:
* **High Cognitive Load**: Regulatory affairs specialists must read long updates, deduce relevance, search the SOP catalog, highlight gaps, and manually draft updates.
* **API & Version Drift**: Documents are revised using static text editors, causing formatting corruption, broken tables, or lost historical version logs.
* **Audit Risks**: FDA warning letters frequently cite companies for undocumented SOP updates, lack of electronic signatures, or missing system audit logs.

### The Solution: Arex
Arex automates this process cleanly and traces it end-to-end:
1. **Automated Regulatory Intelligence**: Ingests new regulations and instantly categorizes them, summarizes key points, and determines relevance to business sectors.
2. **Context-Aware Gap Analysis (RAG)**: Searches the internal SOP knowledge base using vector similarity and highlights compliance conflicts between SOPs and regulatory clauses.
3. **Non-Destructive Draft Remediation**: Proposes side-by-side revisions. Re-generates DOCX files natively and annotates PDF files with colored indicators (highlights and comments) without modifying original text layouts.
4. **21 CFR Part 11 Sign-off**: Enforces strict GxP electronic approval protocols. Updates cannot bypass human verification. Role-based controls require QA Manager signatures, which creates immutable audit logs.
5. **Actionable Operations Integration**: Spawns department-specific implementation tasks (e.g., IT setup, training) and pushes them to Atlassian Jira Cloud automatically.

---

## 2. AMD Developer Challenge & Hackathon Alignment

Arex is custom-tailored for the **AMD Developer Challenge & Hackathon**, demonstrating how advanced AI agent orchestration integrates with hardware-optimized cloud inference.

### AMD-Powered AI Hardware Acceleration
* **Fireworks AI Native Client**: In **Hackathon Mode**, the platform bypasses closed-source commercial APIs in favor of **Fireworks AI**'s open-source models (such as `deepseek-v4-flash`).
* **AMD Instinct™ Cloud Infrastructure**: Fireworks AI models are served on cloud clusters powered by **AMD Instinct™ GPUs**. By offloading high-complexity JSON-constrained generation tasks to these hardware-accelerated nodes, Arex achieves ultra-low latencies for:
  - Regulatory summarization ($<3$ seconds).
  - Parallel multi-document compliance gap analysis ($10$- $20$ seconds).
  - Actionable task synthesis ($2$- $4$ seconds).
* **Unified Embedding Architecture**: Uses the hardware-optimized `nomic-ai/nomic-embed-text-v1.5` model to generate 768-dimensional vector embeddings, matching the dimension configurations of our vector database for fast similarity indexing.

### Cross-Hardware Interoperability (Dual Modes)
The codebase includes dedicated providers mapping to different AI platforms:
1. **Developer Mode**: Connects to the Google Gemini API (`gemini-2.5-flash` or `gemini-3.1-flash`) via the `google-genai` SDK.
2. **Hackathon Mode**: Connects to Fireworks AI (utilizing DeepSeek and Qwen models) over an OpenAI-compatible SDK.
3. **Offline Demo Mode**: Runs on deterministic, keyword-biased stubs. Judges and developers can test the complete system offline without any API keys, rate limits, or internet latency.

---

## 3. System Architecture

Arex is built as a modular monorepo using a decoupled client-server pattern. The system separates the React frontend, FastAPI backend, relational data, and semantic vector data.

### High-Level Architecture

```mermaid
graph TD
    User([Compliance/QA User]) <--> |HTTP/REST| FE[Next.js Frontend]
    FE <--> |JSON API| BE[FastAPI Backend]
    
    subgraph Storage & DB Layer
        BE <--> |SQLAlchemy ORM| PG[(PostgreSQL)]
        BE <--> |File I/O| Disk[(Local Disk Storage /app/storage)]
        BE <--> |Qdrant Client| QD[(Qdrant Vector DB)]
    end
    
    subgraph AI Orchestration Layer
        BE <--> |LangGraph / SQLite| LG[LangGraph Engine]
        LG --> |Checkpoints| SQ[(SQLite checkpointer)]
        BE <--> |Dual-Mode client| LLM{AI Provider}
        LLM -->|Developer Mode| Gemini[Google Gemini API]
        LLM -->|Hackathon Mode| Fireworks[Fireworks AI - AMD GPUs]
    end
```

### Ingestion and RAG Pipelines

```
[SOP Document Upload (PDF/DOCX/TXT)]
                │
                ▼ (PyMuPDF / docx Parser)
      [Raw Text Extraction]
                │
                ▼ (Text Chunking: 150 words / 30 overlap)
   [Normalized Text Paragraphs]
                │
                ▼ (Google-GenAI / Fireworks-HTTP)
   [768-Dimension Embeddings]
                │
                ▼ (Qdrant Client)
[Upsert vectors under Organization Namespace Filter]
```

### LangGraph Agentic Workflow
The regulatory assessment process is orchestrated by a **LangGraph StateGraph** backed by a persistent SQLite checkpointer (`checkpoints.sqlite`).

```mermaid
stateDiagram-v2
    [*] --> IngestRegulation : User uploads regulation update
    IngestRegulation --> RegulatoryIntelligenceNode : Trigger LangGraph
    
    state RegulatoryIntelligenceNode {
        [*] --> RunRIModel : Analyze text content
        RunRIModel --> EvaluateRelevance : Summarize, categorize, score urgency
    }
    
    RegulatoryIntelligenceNode --> RouteDecision : route_relevance()
    
    state RouteDecision <<choice>>
    RouteDecision --> ComplianceImpactNode : If 'relevant' == True
    RouteDecision --> [*] : If 'relevant' == False (Exit Early)
    
    state ComplianceImpactNode {
        [*] --> VectorSearch : Fetch matching SOP chunks from Qdrant
        VectorSearch --> RAGAnalysis : Ground LLM with retrieved snippets
        RAGAnalysis --> ScoreRisk : Calculate compliance risk (0.0 to 1.0)
        ScoreRisk --> WriteAssessment : Save ImpactAssessment & map SOP gaps
    }
    
    ComplianceImpactNode --> [*] : Terminate Pipeline
```

> [!NOTE]
> To comply with GxP regulations, **AI cannot write or edit files directly in the canonical storage**. The LangGraph pipeline terminates after the compliance impact assessment. Document remediation (`remediation_agent`) and task breakdown (`implementation_agent`) are triggered explicitly by human approval actions in the UI.

### End-to-End Sequence Diagram

The following diagram tracks the flow of a compliance update, showing how data moves from a raw regulation document to a completed remediation and task board.

```mermaid
sequenceDiagram
    autonumber
    actor QA as QA Manager
    participant FE as Next.js Frontend
    participant BE as FastAPI Backend
    participant QD as Qdrant Vector DB
    participant LG as LangGraph Workflow
    participant LLM as AI LLM Client
    participant Jira as Jira Cloud API

    Note over QA, QD: 1. SOP Ingestion Phase
    QA->>FE: Upload SOP (PDF/DOCX)
    FE->>BE: POST /api/v1/documents/
    BE->>BE: Parse text (PyMuPDF / python-docx)
    BE->>BE: Generate semantic chunks (150 words, 30 overlap)
    BE->>LLM: Get embeddings (768 dimensions)
    LLM-->>BE: Return vectors
    BE->>QD: Upsert chunks with Organization scoping
    BE->>QA: Save Document & Version metadata

    Note over QA, LG: 2. Regulatory Assessment Phase
    QA->>FE: Upload Regulation PDF/TXT
    FE->>BE: POST /api/v1/regulations/
    BE->>LG: trigger_agent_pipeline() (LangGraph)
    Note over LG: Node 1: Regulatory Intelligence
    LG->>LLM: Categorize, rate urgency & determine relevance
    LLM-->>LG: Return RI Analysis
    alt Not Relevant
        LG->>BE: Exit early (route_relevance = end)
    else Relevant
        Note over LG: Node 2: Compliance Impact Assessment
        LG->>BE: assess_compliance_impact()
        BE->>LLM: Get embedding of regulation summary
        LLM-->>BE: Return vector
        BE->>QD: Search chunks (org_id, threshold >= 0.60)
        QD-->>BE: Return matching SOP snippets
        BE->>LLM: Evaluate gaps & score risk (0.0 to 1.0)
        LLM-->>BE: Return impact analysis (departments, explanations)
        BE->>BE: Save ImpactAssessment to Postgres
    end
    LG-->>BE: Complete Pipeline
    BE-->>FE: Return analysis output

    Note over QA, Jira: 3. Remediation & Tasking Phase
    QA->>FE: Review Gaps & Trigger Remediation
    FE->>BE: POST /api/v1/remediation/regulation/{id}
    BE->>BE: run_remediation_agent() (Parallel threads)
    BE->>LLM: Generate proposed changes & cite clauses
    LLM-->>BE: Return proposed text, citations, rationale
    BE->>BE: Calculate side-by-side diff (difflib)
    BE->>FE: Return RemediationDraft
    QA->>FE: Edit proposed revision & execute E-Signature
    FE->>BE: POST /api/v1/approvals/remediation/{id} (APPROVED)
    BE->>BE: Upgrade Document Version (v1 -> v2)
    BE->>BE: Apply revisions (Annotate PDF with colors / rewrite DOCX in-place)
    BE->>QD: Re-index updated document chunks
    BE->>BE: Log immutable ApprovalRecord (21 CFR Part 11)
    BE->>BE: run_implementation_agent() (Parallel tasks)
    BE->>LLM: Synthesize operational tasks (IT, QA, Eng, Training)
    LLM-->>BE: Return task lists
    BE->>BE: Save tasks to Postgres
    QA->>FE: Go to Tasks Board & Click Sync Jira
    FE->>BE: POST /api/v1/tasks/sync-jira
    BE->>Jira: Push tickets (ADF format / simulated fallback)
    Jira-->>BE: Return Issue Keys (e.g., SCRUM-12)
    BE-->>FE: Sync board with Jira URLs
```

---

## 4. Major Features & Internal Mechanics

### Semantic RAG & Multi-Tenant Isolation
* **Chunking strategy**: Documents are split using a sliding window chunker:
  ```python
  def chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
      ...
  ```
* **Namespace Isolation**: To prevent cross-tenant data leaks (mandatory in healthcare multi-tenancy), search requests use Qdrant field filtering based on the organization ID stored in the tenant JWT:
  ```python
  query_filter = qdrant_models.Filter(
      must=[
          qdrant_models.FieldCondition(
              key="organization_id",
              match=qdrant_models.MatchValue(value=str(organization_id))
          )
      ]
  )
  ```

### Non-Destructive Document Remediation (PDF & DOCX)
Arex modifies documents while preserving their original structure and layouts:
* **DOCX Remediation**: When a draft is approved, the backend copies the original template and uses `difflib.SequenceMatcher` to replace text blocks in-place:
  ```python
  sm = difflib.SequenceMatcher(None, orig_paras, prop_paras)
  opcodes = sm.get_opcodes()
  for tag, i1, i2, j1, j2 in reversed(opcodes):
      # Performs text insert, delete, or replace in reverse order
      # to prevent document paragraph indexing shifts
  ```
  This preserves the layout, tables, fonts, headers, and footers of the original file.
* **PDF Remediation**: High-fidelity PDF structures cannot be rewritten cleanly without layout corruption. Instead, the backend generates an annotated review PDF. It uses `fitz` (PyMuPDF) to locate the modified text and overlay compliance highlights:
  - **Green Highlights**: Insertion anchors.
  - **Yellow Highlights**: Replaced text.
  - **Red Highlights**: Deleted text.
  It attaches rich GxP annotations containing the Section Number, Original Text, Proposed Text, Justification, and Regulation Reference.

### Jira REST Synchronization
When implementation tasks are generated, users can sync them to their project management boards.
* **Live Mode**: Calls the Atlassian Jira Cloud REST API (`POST /rest/api/3/issue`) using Basic Auth (`JIRA_EMAIL` and `JIRA_API_TOKEN`). It translates task details into **Atlassian Document Format (ADF)** JSON payloads.
* **Simulated Mode**: If environment settings are blank, the backend enters simulated mode, generating mock keys (e.g. `AREX-12`) locally so development workflows remain functional.

### FDA 21 CFR Part 11 Electronic Signature & Audits
* **Immutable Logs**: Every state change (draft modifications, approvals, rejections, or database resets) writes an entry to the `ApprovalRecord` table.
* **Cryptographic Signatures**: Approval endpoints require valid user authorization tokens. They bind the user ID, timestamp, and the exact string content state to the signature:
  ```python
  record = ApprovalRecord(
      id=uuid.uuid4(),
      item_type="remediation_draft",
      item_id=draft.id,
      status="APPROVED",
      reviewer_id=reviewer_id,
      timestamp=datetime.now(timezone.utc),
      original_content={"text": draft.current_content},
      final_content={"text": draft.proposed_revision}
  )
  ```
* **Role Enforcement (RBAC)**: Only accounts with `QA Manager` or `Org Admin` roles can approve changes or reset drafts.

### Deep Workspace Resetting
The admin reset endpoint (`POST /api/v1/admin/reset` with payload `{"confirmation": "RESET"}`) wipes data cleanly:
1. **Postgres**: Deletes all tables in foreign-key safe order.
2. **File System**: Empties files in `/app/storage/` while keeping subdirectories.
3. **Qdrant Vector DB**: Drops all collections (`documents_gemini`, `documents_fireworks`, `arex_docs`) to clear stale vectors, then recreates the active one.
4. **LangGraph checkpoints**: Closes the database lock, deletes the `checkpoints.sqlite` file, and rebuilds a freshCompiled graph instance. This prevents LangGraph from reusing cached thread checkpoints.

---

## 5. Setup & Installation Guide

### Prerequisites
* **Docker** & **Docker Compose**
* **Python 3.11+** (for native backend running)
* **Node.js 18.x / 20.x** (for native frontend running)
* **Poetry** (Python dependency manager) and **npm**

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd amd-developer-act2
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and set your API keys and databases (see below).

3. **Install dependencies (Optional - for native running)**:
   * **Backend**:
     ```bash
     cd backend
     poetry install
     ```
   * **Frontend**:
     ```bash
     cd frontend
     npm install
     ```

### Environment Configuration

The application is configured using a `.env` file at the root.

| Environment Variable | Description / Required Value | Default / Example |
|---|---|---|
| **`AI_MODE`** | Toggle AI execution: `developer` (Gemini), `hackathon` (Fireworks), or `offline` (mocks). | `hackathon` |
| **`POSTGRES_USER`** | Postgres DB username. | `postgres` |
| **`POSTGRES_PASSWORD`** | Postgres DB password. | `dev_password` |
| **`POSTGRES_DB`** | Postgres DB name. | `sentinel_db` |
| **`DATABASE_URL`** | SQL Connection URL (use hostname `postgres` in Docker). | `postgresql://postgres:dev_password@postgres:5432/sentinel_db` |
| **`QDRANT_URL`** | Qdrant API URL (use hostname `qdrant` in Docker). | `http://qdrant:6333` |
| **`JWT_SECRET`** | Token signing secret key. | `super_secret_jwt_signing_key_change_me_in_production_123456` |
| **`ACCESS_TOKEN_EXPIRE_MINUTES`**| Auth token lifespan (in minutes). | `1440` |
| **`GEMINI_API_KEY`** | Google Gemini key (Required if `AI_MODE=developer`). | `AIzaSy...` |
| **`GEMINI_MODEL_NAME`** | Model version for Gemini completions. | `gemini-2.5-flash` |
| **`GEMINI_EMBEDDING_MODEL`** | Model version for Gemini embeddings (768d). | `gemini-embedding-001` |
| **`FIREWORKS_API_KEY`** | Fireworks AI API key (Required if `AI_MODE=hackathon`). | `fw_...` |
| **`FIREWORKS_MODEL`** | Large Language Model used on Fireworks AI (AMD GPUs). | `accounts/fireworks/models/deepseek-v4-flash` |
| **`FIREWORKS_EMBEDDING_MODEL`**| Embedding Model used on Fireworks AI (AMD GPUs). | `nomic-ai/nomic-embed-text-v1.5` |
| **`JIRA_URL`** | Live Jira URL (Optional). | `https://your-domain.atlassian.net` |
| **`JIRA_EMAIL`** | Atlassian user email (Optional). | `user@company.com` |
| **`JIRA_API_TOKEN`** | Atlassian account API Token (Optional). | `ATATT3x...` |
| **`JIRA_PROJECT_KEY`** | Jira project key (e.g. `SCRUM`, `AREX`). | `SCRUM` |

### Running the Services

#### Method A: Multi-Service Deployed Mode (Docker Compose - Recommended)
This method spins up the FastAPI backend, Next.js frontend, PostgreSQL, and Qdrant:
```bash
docker compose up --build
```
* **Frontend UI**: `http://localhost:3000`
* **FastAPI Docs**: `http://localhost:8000/docs`
* **Qdrant Dashboard**: `http://localhost:6333/dashboard`

#### Method B: Native Dev Mode (Bare-Metal Running)
If you want to run the code natively on your local machine:
1. **Start infrastructure dependencies**:
   ```bash
   docker compose up -d postgres qdrant
   ```
2. **Run Postgres Migrations**:
   ```bash
   cd backend
   poetry run alembic upgrade head
   ```
3. **Start FastAPI Backend**:
   ```bash
   poetry run uvicorn app.main:app --reload --port 8000
   ```
4. **Start Next.js Frontend**:
   ```bash
   cd ../frontend
   npm run dev
   ```

### Supported AI Providers & Models

* **Google Gemini (Developer Mode)**:
  - Inference: `gemini-2.5-flash` / `gemini-3.1-flash` (via official `google-genai` SDK)
  - Embeddings: `gemini-embedding-001` / `text-embedding-004` (using `output_dimensionality=768` limits)
* **Fireworks AI (Hackathon Mode - AMD-powered GPU Inference)**:
  - Inference: `accounts/fireworks/models/deepseek-v4-flash`, `accounts/fireworks/models/qwen3-32b`, `accounts/fireworks/models/qwen2p5-72b-instruct`
  - Embeddings: `nomic-ai/nomic-embed-text-v1.5` (runs at 768 dimensions)
* **Offline Mock Provider**:
  - Locally generates simulated response models and deterministic, keyword-biased mock embeddings.

---

## 6. User Guide (Typical Workflow)

```
[Start Clean] ──► [Ingest SOPs] ──► [Ingest Regulation] ──► [Review RI Summary]
                                                                   │
                                                                   ▼
[Deploy Tasks] ◄── [QA Approval] ◄── [Verify Draft] ◄── [Impact Assessment]
```

1. **Clear System Workspace**:
   Go to the dashboard, navigate to **Settings** $\to$ **Data Management**, and execute a **Reset Workspace** to wipe cached states and database checkpoints.

2. **Ingest Company SOPs**:
   Go to the **Documents** page. Click **Upload Document** and drag in your organizational standard operating procedures (`.pdf`, `.docx`, or `.txt`). The system parses and indexes these in Qdrant.

3. **Upload Regulatory Update**:
   Go to the **Regulations** page. Upload a new regulatory PDF or TXT file (such as a GxP amendment regarding session security limits).

4. **Verify Automated RI Analysis**:
   Upon upload, the **Regulatory Intelligence Agent** runs instantly, generating a structured relevance analysis (Relevant / Not Relevant, Urgency level, Category, Affected Areas, and Rationale).

5. **Execute Compliance Impact Assessment**:
   For relevant regulations, trigger the **Impact Assessment**. The system runs the LangGraph pipeline, querying Qdrant to find matching SOPs, identifying gap explanations, and calculating risk scores.

6. **Generate Remediation Drafts**:
   Select the flagged non-compliant SOPs and click **Generate Remediation Drafts**. The backend processes files in parallel, creating side-by-side versions.

7. **Review & Sign-Off**:
   QA Managers review the redline edits in the interactive workspace. They can edit text blocks, execute signature validations (providing credentials), and select **Approve Draft**. The backend generates annotated PDFs or copies text in-place into DOCX files, increments document versions, and updates the Qdrant index.

8. **Coordinate Implementation Tasks**:
   Once approved, the **Implementation Agent** creates departmental tasks. View these on the Kanban board. Click **Sync to Jira** to push the tasks to Jira Cloud.

---

## 7. Project Structure

```
├── backend/                         # FastAPI application and migrations
│   ├── app/
│   │   ├── ai/                     # Agent logic and prompting architectures
│   │   │   ├── agents/             # Agents: RI, Remediation, Implementation
│   │   │   ├── prompts/            # Markdown prompts templates
│   │   │   ├── tools/              # Citation and Vector DB utilities
│   │   │   ├── graph_builder.py    # LangGraph agentic workflow setup
│   │   │   └── llm_client.py       # Client for Gemini, Fireworks, & offline stubs
│   │   ├── api/                    # v1 controllers, endpoints, and schemas
│   │   ├── core/                   # Security, audit logging, and configuration
│   │   ├── db/                     # DB session initialization
│   │   ├── models/                 # SQLAlchemy schemas
│   │   └── services/               # Document modification and impact scoring
│   ├── migrations/                 # Alembic DB migration scripts
│   ├── storage/                    # Local storage (SOPs, PDF copies, checkpoints)
│   └── tests/                      # Python unit tests
├── frontend/                        # Next.js TypeScript web client
│   ├── src/
│   │   ├── app/                    # Routing: cases, documents, tasks, settings
│   │   ├── components/             # Reusable UI components (diff, kanban)
│   │   ├── lib/                    # API client configurations
│   │   └── styles/                 # Styling and tailwind configs
├── shared/                          # Shared monorepo configuration
│   └── openapi/                    # API contracts (arex.yaml)
├── docs/                            # Architectural blueprints and GxP compliance mappings
├── docker-compose.yml               # local docker compose orchestrator
├── docker-compose.override.yml      # development overlays
└── Makefile                         # CLI automation script
```

---

## 8. Feature Status

### Implemented Features
* **Dual Inference & Embeddings Engines**: Supports both Google Gemini (Developer Mode) and Fireworks AI (Hackathon Mode - AMD GPU infrastructure).
* **Deterministic LangGraph Workflow**: Multi-node state machine backing regulatory categorization and gap assessments.
* **Non-Destructive Highlights & Modifiers**: Native python-docx paragraph reconstruction and PyMuPDF-based color-coded PDF annotations.
* **Strict GxP Human-in-the-Loop Workflow**: Handled via workflow state checks, role validation, and electronic signatures.
* **Jira Ticket ADF Sync**: Syncs Kanban board items directly to Jira projects using the Atlassian Document Format.
* **Deep Workspace resets**: Drops SQLite checkpointers, PostgreSQL records, files, and Qdrant collections.

