# Arex

## 1. Project Overview

**Project Name:** Arex
**Purpose of the application:** A high-fidelity regulatory compliance intelligence platform designed to automate and streamline compliance mapping for FDA 21 CFR Part 11 and other critical regulations.
**Problem it solves:** Manual regulatory audits and compliance gap analyses are tedious, error-prone, and require deep domain expertise. Arex bridges AI orchestration layers with deterministic workflows and human approval gates to ensure GxP audit-readiness, significantly accelerating the process of updating company documents when new regulations are released.
**Intended users:** Quality Assurance (QA) Managers, Compliance Officers, Regulatory Affairs Specialists, and IT Departments in highly regulated industries like BioPharma and Healthcare.
**Key capabilities and features:**
- Automated extraction and ingestion of Standard Operating Procedures (SOPs).
- RAG-powered compliance impact assessments using local or cloud AI models.
- Non-destructive remediation generation (Copy-then-Annotate) for PDF and DOCX files.
- Automated creation of actionable implementation tasks.
- A comprehensive React-based UI for managing the entire compliance lifecycle.

---

## 2. Architecture

**High-level system architecture:**
Arex uses a decoupled client-server architecture deployed via Docker Compose. The system separates the user interface, business logic, relational data, and semantic vector data into distinct services.

**Major Components:**
- **Frontend:** A Next.js (React) Single Page Application utilizing the App Router.
- **Backend:** A FastAPI (Python) web service handling core logic, document processing, and deterministic validation.
- **Database:** PostgreSQL (relational) storing metadata, users, organizations, approval records, and implementation tasks.
- **Vector Database:** Qdrant for semantic document chunk storage and fast RAG lookups.
- **AI Services & APIs:** LangGraph agentic workflows connecting to Gemini API (or Fireworks.ai) for LLM inference and token embeddings.

**Data Flow:**
1. **Upload:** Users upload documents (SOPs) or regulations via the Next.js Frontend.
2. **Ingestion:** The FastAPI backend parses the documents (using `PyMuPDF` or `pdfplumber`), chunks the text, and calls the embedding API.
3. **Storage:** Vectors are stored in Qdrant; metadata (author, version, timestamps) is stored in PostgreSQL.
4. **Assessment:** When an assessment is triggered, LangGraph agents query Qdrant (RAG) to find relevant SOP chunks that map to the new regulation.
5. **Remediation:** The AI generates text-based diffs and justifications. The backend applies these non-destructively, preserving the original file and creating a new version.
6. **Tasking & Approval:** After user approval in the frontend, the backend records the approval and generates corresponding implementation tasks.

**AI Pipeline:**
- **Document Ingestion:** Parses raw PDF/DOCX into standardized text.
- **Embeddings:** Vectorizes text using `text-embedding-004` (or similar models).
- **RAG:** Semantic search to ground AI answers in the user's specific SOPs.
- **Impact Analysis:** LangGraph agents determine whether a document is non-compliant, highlighting specific gaps.
- **Remediation Generation:** Proposes specific inline additions and deletions.
- **Task Creation:** Synthesizes actionable IT/Process tasks based on the approved document changes.

---

## 3. Technology Stack

- **Programming Languages:** Python 3.11, TypeScript, JavaScript
- **Frameworks:** FastAPI, Next.js 14 (App Router)
- **Libraries:** SQLAlchemy, Alembic, LangGraph, Pydantic, PyMuPDF, Tailwind CSS, Lucide React
- **Databases:** PostgreSQL (Relational), Qdrant (Vector)
- **AI Models/Services:** Google Gemini API (Inference & Embeddings) or Fireworks.ai via OpenAI-compatible endpoints.
- **External APIs:** Standard OpenAI-compatible client schemas for LLMs.
- **Development Tools:** Docker, Docker Compose, Poetry (Python), npm (Node.js), Make, Pytest, ESLint

---

## 4. Project Structure

- **`/backend/`**: Contains the FastAPI application, LangGraph agents, and background workers.
  - **`app/api/`**: API routes and endpoints (e.g., v1 controllers).
  - **`app/ai/`**: LangGraph graph builders, prompts, and agent logic.
  - **`app/services/`**: Core business services (e.g., document modifiers, vector DB connectors).
  - **`app/models/`**: SQLAlchemy database schemas.
- **`/frontend/`**: The Next.js client-facing application.
  - **`src/app/`**: Next.js page routing and layouts.
  - **`src/components/`**: Reusable React UI components (e.g., RedlineDiffViewer).
- **`/infra/`**: Docker configurations (`backend.Dockerfile`, `frontend.Dockerfile`).
- **`/shared/`**: Common assets, such as OpenAPI specification contracts.
- **`/docs/`**: Architecture Decision Records (ADRs) and project planning documents.
- **`docker-compose.yml`**: Orchestrates the local deployment of all services.

---

## 5. Features

- **Document Management:** Secure upload, parsing, and versioning of organizational SOPs.
- **Regulation Management:** Track FDA 21 CFR Part 11 updates and other external rules.
- **Regulatory Summary:** AI-powered executive summaries of regulatory changes, including urgency and relevance classification.
- **Impact Assessment:** Automated gap analysis highlighting non-compliant SOP sections.
- **Remediation Draft Generation:** Generates proposed document edits with a side-by-side redline diff viewer.
- **Implementation Tasks:** Generates a tasks board of action items (e.g., IT configuration changes) required for compliance.
- **Workspace Reset:** Deep reset endpoint that purges LangGraph checkpoints, Qdrant indices, PostgreSQL data, and storage directories.
- **RAG Pipeline:** Context-aware grounding that retrieves exact document chunks to justify AI decisions.
- **AI Agents:** Multi-step reasoning agents that handle complex classification and generation logic.

---

## 6. Prerequisites

- **Required software:** Docker (Docker Desktop or Docker Engine), Git
- **Python version:** 3.11+ (if running backend natively without Docker)
- **Node.js version:** 18.x or 20.x (if running frontend natively)
- **Package managers:** `poetry` (Python), `npm` (Node.js)

---

## 7. Installation Guide

**Step-by-step setup from a clean machine:**

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd amd-developer-act2
   ```
2. **Environment configuration:**
   Copy the example environment file and configure it (see Section 8).
   ```bash
   cp .env.example .env
   ```
3. **Install backend dependencies (Optional, for local non-Docker development):**
   ```bash
   cd backend
   # Create Python virtual environment and install packages
   poetry install
   ```
4. **Install frontend dependencies (Optional, for local non-Docker development):**
   ```bash
   cd frontend
   npm install
   ```
5. **Database and Vector Database setup:**
   Start the supporting services using Docker Compose.
   ```bash
   docker compose up -d postgres qdrant
   ```
6. **Initialize required services (Database Migrations):**
   Run backend migrations to set up PostgreSQL schemas.
   ```bash
   cd backend
   poetry run alembic upgrade head
   cd ..
   ```
7. **Start the application (Docker method - Recommended):**
   Build and start all services (Backend and Frontend).
   ```bash
   docker compose up --build -d
   ```
8. **Verify the application is running correctly:**
   - Frontend: Open `http://localhost:3000` in your browser.
   - Backend API Docs: Open `http://localhost:8000/docs`.

---

## 8. Environment Configuration

The application is configured via a `.env` file in the root directory. Below is the complete `.env.example` mapping based on the codebase.

```env
# ==============================================================================
# Arex - Environment Configuration
# ==============================================================================

# AI_MODE: Set to 'online' for live API calls, 'offline' for mock responses. (Required)
AI_MODE=online

# PostgreSQL Settings (Required)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dev_password
POSTGRES_DB=sentinel_db
# Connection string used by SQLAlchemy (In docker, host is 'postgres')
DATABASE_URL=postgresql://postgres:dev_password@postgres:5432/sentinel_db

# Qdrant Vector DB Settings (Required)
# Use http://qdrant:6333 inside Docker or http://localhost:6333 locally
QDRANT_URL=http://qdrant:6333

# Security & JWT Configuration (Required)
JWT_SECRET=super_secret_jwt_signing_key_change_me_in_production_123456
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Gemini AI Settings (Required if AI_MODE=online)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_NAME=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# Legacy LLM Settings (Optional fallback/Fireworks.ai support)
LLM_API_KEY=your_fallback_api_key
LLM_API_BASE=
LLM_MODEL_NAME=gemini-2.5-flash
EMBEDDING_API_KEY=your_fallback_api_key
EMBEDDING_MODEL_NAME=text-embedding-004
```

**Variable Explanations:**
- `AI_MODE`: Toggles whether the application actually calls external LLMs or uses deterministic offline stubs (useful for local UI testing). Required.
- `POSTGRES_*`: Credentials and database name for the relational database. Required.
- `DATABASE_URL`: The full SQLAlchemy connection string. Required.
- `QDRANT_URL`: The network path to the Qdrant instance. Required.
- `JWT_SECRET`: Used to sign authentication tokens. Must be changed in production. Required.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Lifespan of the auth token. Optional (defaults to 1440).
- `GEMINI_API_KEY`: Primary key for LLM inference and embeddings. Required if using online mode.
- `GEMINI_MODEL_NAME` / `GEMINI_EMBEDDING_MODEL`: Specific model versions to use. Required if using Gemini.
- `LLM_*` and `EMBEDDING_*`: Fallback or alternative provider settings (e.g., Fireworks.ai). Optional.

---

## 9. Configuration

Additional project configuration details:
- **API Keys & AI Providers:** The backend uses standard OpenAI-compatible client schemas, allowing interchangeability between Gemini and Fireworks.ai.
- **Database & Vector DB Connection:** In a Docker network environment, use `postgres` and `qdrant` as hostnames. For local bare-metal execution, change to `localhost`.
- **Authentication:** Handled via JWT. Ensure `JWT_SECRET` is strong in production environments.
- **CORS Settings:** The FastAPI backend uses `CORSMiddleware`. Allowed origins are configured via application settings to permit the Next.js frontend to communicate securely.
- **Upload Directories / File Storage:** Uploaded PDFs and generated remediation files are stored in the backend container's `/app/storage` directory, mapped to a Docker volume or local path for persistence.
- **Logging:** Configured in `backend/app/main.py` using standard Python `logging`. Outputs structured info and error logs to standard output for Docker aggregation.

---

## 10. Running the Project

**Running all services together (Docker Compose):**
```bash
docker compose up --build
```
*(This starts the frontend on port 3000, backend on 8000, plus postgres and qdrant).*

**Backend only (Local Development):**
```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8000
```

**Frontend only (Local Development):**
```bash
cd frontend
npm run dev
```

---

## 11. Usage Guide

**Typical Workflow:**

1. **Create or reset workspace:** Navigate to the admin settings endpoint (`POST /admin/reset`) or UI button to wipe AI states, databases, and vectors for a clean slate.
2. **Upload company documents:** Navigate to the Documents section (`/documents`) and upload your SOPs. The backend will parse, chunk, and store embeddings.
3. **Upload FDA regulation:** Navigate to the Regulations section and upload or select a newly issued regulatory update.
4. **Generate Regulatory Summary:** The system's agents automatically classify the regulation's urgency and generate a summary upon ingestion.
5. **Run Impact Assessment:** Trigger the AI assessment. The system uses RAG to fetch relevant SOP chunks and evaluates compliance gaps against the regulation.
6. **Review affected documents:** View the Impact Assessment report to see which documents are flagged as High Risk / Non-Compliant.
7. **Generate Remediation Drafts:** Request fixes. The AI proposes additions/deletions via a side-by-side Diff Viewer while keeping the original document intact.
8. **Approve drafts:** Click "Approve Draft". The status updates and a new document version is finalized in the system.
9. **Create implementation tasks:** The approved remediation automatically spawns action items on the Tasks Board (e.g., for IT to configure a new MFA timeout).
