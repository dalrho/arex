# Contributing to Sentinel OS

Welcome! This guide outlines how to set up, develop, and test Sentinel OS locally.

---

## 1. How to Run Locally

We use Docker Compose to manage local development databases, vector stores, and application runtimes.

1. Ensure Docker and Docker Compose are installed.
2. In the root directory, configure your environment variables:
   ```bash
   cp .env.example .env
   ```
3. Boot the environment using the orchestrating Makefile:
   ```bash
   make up
   # Or directly: docker compose up --build
   ```
4. Access the services:
   * **Frontend**: `http://localhost:3000`
   * **FastAPI Backend Docs**: `http://localhost:8000/docs`
   * **Qdrant Vector Store**: `http://localhost:6333`

---

## 2. How to Add a New API Endpoint

All Sentinel OS APIs must conform to the safety-critical multi-tenant design patterns:

1. **API Router**: Mount routes inside `backend/app/api/v1/endpoints/`.
2. **Scoping**: Ensure the endpoint injects the multi-tenant dependency `get_tenant_id` to filter results:
   ```python
   @router.get("/documents")
   def read_docs(
       db: Session = Depends(get_db), 
       tenant_id: str = Depends(get_tenant_id)
   ):
       # Always query database using tenant_id filter constraint
       return service.get_documents_by_tenant(db, tenant_id)
   ```
3. **OpenAPI**: Register the new endpoint in `shared/openapi/sentinel-os.yaml`.

---

## 3. How to Add Tests

Tests are required to validate security compliance.

* **Backend Tests**:
  * Located under `backend/tests/`.
  * Add unit tests using standard `pytest` conventions.
  * Execute checks locally:
    ```bash
    make test
    ```
* **Frontend Tests**:
  * Located under `frontend/src/tests/` (stubbed for now).
  * Run syntax validation:
    ```bash
    npm run lint
    ```
