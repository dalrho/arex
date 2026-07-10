# Sentinel OS

Sentinel OS is a high-fidelity regulatory compliance intelligence platform designed to automate and streamline compliance mapping for **FDA 21 CFR Part 11**. It bridges AI orchestration layers (via LangGraph agents) with deterministic workflows and human approval gates to ensure GxP audit-readiness.

---

## 1. Directory Layout

The workspace is a monorepo structured as follows:
- **`backend/`**: FastAPI app (Python 3.11), SQLAlchemy ORM models, LangGraph agents, and background workers.
- **`frontend/`**: Next.js 14 (App Router) client-facing application using vanilla CSS and Tailwind primitives.
- **`shared/`**: OpenAPI spec contract (`sentinel-os.yaml`) serving as the single source of truth.
- **`infra/`**: Docker setups, seeding utilities, and PostgreSQL migration schemas.
- **`docs/`**: ADRs (Architecture Decision Records), decision logs, and regulatory mappings.

---

## 2. API Compatibility (Fireworks.ai & Google Gemini)

### Core Architecture
Sentinel OS uses standard OpenAI-compatible client schemas for both LLM text generation and token embeddings. This means the system is fully compatible out-of-the-box with **both** your production provider (**Fireworks.ai**) and testing/free tier provider (**Google Gemini**) using Gemini's OpenAI-compatibility layer.

### How to Configure `.env`

Create a `.env` file in the project root from the template:
```bash
cp .env.example .env
```

#### Option A: Production Setup (Fireworks.ai)
Use Fireworks.ai for premium agent orchestration (e.g., Qwen 2.5 72B):
```ini
LLM_API_KEY=your_fireworks_api_key_here
LLM_API_BASE=https://api.fireworks.ai/inference/v1
LLM_MODEL_NAME=accounts/fireworks/models/qwen2p5-72b-instruct

EMBEDDING_API_KEY=your_fireworks_api_key_here
EMBEDDING_MODEL_NAME=nomic-ai/nomic-embed-text-v1.5
```

#### Option B: Testing / Free Tier Setup (Google Gemini)
You can leverage Google Gemini's free tier for development. Use Google AI Studio to get an API key, then configure it using Gemini's OpenAI translation URL:
```ini
LLM_API_KEY=your_gemini_api_key_here
LLM_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL_NAME=gemini-1.5-flash   # Or gemini-1.5-pro / gemini-2.0-flash-exp

EMBEDDING_API_KEY=your_gemini_api_key_here
EMBEDDING_MODEL_NAME=text-embedding-004
```

> [!NOTE]
> **Offline Mock Mode:** If no keys are specified in `.env`, the system automatically runs in a deterministic offline mock mode. This generates realistic compliance responses and semantic embeddings without failing, making local development and offline demos completely seamless.

---

## 3. Run and Test Commands

### Running the Services
Sentinel OS uses Docker Compose to manage PostgreSQL, Qdrant, FastAPI backend, and Next.js frontend services.

*   **Spin Up Services (in detached mode):**
    ```bash
    make up
    ```
*   **Stop and Remove Containers:**
    ```bash
    make down
    ```
*   **Rebuild Container Images:**
    ```bash
    make build
    ```
*   **Recreate/Restart specific service (e.g., Backend):**
    ```bash
    docker compose restart backend
    ```

### Seeding GxP Data
Populate PostgreSQL and Qdrant with initial test data (organizations, users, standard operating procedures, and a sample FDA regulation update):
```bash
make seed
```

### Running Tests and Linters

*   **Run Backend Unit Tests (inside Docker):**
    ```bash
    docker compose exec -e PYTHONPATH=. backend pytest
    ```
*   **Run Frontend Type Checking (inside Docker):**
    ```bash
    docker compose exec frontend npm run type-check
    ```
*   **Run Frontend ESLint Checks (inside Docker):**
    ```bash
    docker compose exec frontend npm run lint
    ```
*   **Check Live Container Logs:**
    ```bash
    # View all service logs
    docker compose logs -f
    # View backend container logs only
    docker compose logs -f backend
    ```

---

## 4. UI-Backend Verification Guide

To manually verify that the frontend and backend are communicating correctly and the compliance workflow is operational:

### Step 1: User Login
1. Open your browser and navigate to `http://localhost:3000/login`.
2. Login using the pre-seeded GxP QA Manager credentials:
   - **Email:** `qa@biopharma.com`
   - **Password:** `password`
3. Upon success, you will be redirected to the main dashboard (`/dashboard`).

### Step 2: Verification of Ingestion (Epic 1)
1. Go to the **Documents** section (`http://localhost:3000/documents`).
2. Verify you see the seeded SOP files (e.g., `SOP-101.txt`, `SOP-102.txt`, `SOP-103.txt`, `SOP-104.txt`).
3. Upload a standard PDF or text document using the drag-and-drop uploader.
4. Check backend logs to verify the file was parsed, chunked, and upserted to Qdrant:
   ```bash
   docker compose logs -f backend
   # Look for: "Successfully upserted X chunks for document..."
   ```

### Step 3: End-to-End Regulatory Review (Epic 3–9)
1. Go to the **Regulations** feed section (`http://localhost:3000/regulations`).
2. Click on the pre-seeded update: *"FDA Mandatory Multi-Factor Authentication and Session Idle Timeout Requirements (2026)"*.
3. Verify that the **AI Classification Summary** displays:
   - **Verdict:** Relevant
   - **Urgency:** High/Critical
   - **Rationale:** Mentions MFA requirements and session idle timeout impacts.
4. Verify the **Impact Assessment** panel:
   - Displays a High Risk level.
   - Accurately targets **SOP-101** (Access Control) as the primary affected document because the regulation requires a 15-minute timeout while the SOP currently specifies 30 minutes.
5. Navigate to **Remediation** view:
   - Verify the diff viewer (`RedlineDiffViewer`) highlights the changes side-by-side or inline:
     - **Additions (Green):** MFA requirement lines added.
     - **Deletions (Red):** 30-minute timeout lines removed.
     - Hover over citations to ensure traceable links to 21 CFR rules.
6. Verify the **Tasks Board**:
   - Check that two action items were created: MFA Active Directory implementation (IT Department) and timeout configuration update (Engineering).
7. Approve the Draft:
   - Click **Approve Draft** in the workflow action bar. The status will transition from `PENDING_REVIEW` to `APPROVED`.
8. Test Report Exporting:
   - Click **Export PDF** or **Export Word**. Verify the downloaded report contains the approved changes, metadata, and status badges.

