# Architecture Decision Records for Sentinel OS

This document logs safety-critical and system design decisions made during the architecture and execution of Sentinel OS.

---

## ADR-0001: Monorepo Layout (Backend + Frontend in Single Repo) vs. Separate Repos

### Status
Accepted

### Context
Sentinel OS requires tightly coupled schemas for 21 CFR Part 11 auditing and AI document ingestion pipelines, while deploying backend (FastAPI) and frontend (Next.js) as distinct dockerized microservices. We need to decide whether to divide these environments into separate code repositories or manage them in a structured monorepo.

### Decision
We will employ a unified Monorepo layout structure:
* `/backend` for Python FastAPI services.
* `/frontend` for Next.js web application.
* `/infra` for Docker Compose orchestration, PostgreSQL initialization, and environment management.
* `/shared` for shared contracts, OpenAPI schemas, and documentation.

### Rationale
* **Synchronized Changes**: Changes to API specifications (like `shared/openapi/sentinel-os.yaml`) can be refactored on both client and server in a single pull request, reducing integration delays.
* **Streamlined Dev Setup**: A single `docker-compose.yml` and `Makefile` orchestrates the local stack.

### Consequences
* Large codebase footprint, mitigated by maintaining clear subproject boundaries (`/backend` vs `/frontend`).
