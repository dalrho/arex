# [EPIC-11-STORY-11.1] DevOps & Environment Setup - Docker & Initial Seeding

**Epic:** EPIC 11 — DevOps & Environment
**User Story:** As a Developer, I want one-command local setup so the whole stack runs consistently.

## Description
This ticket represents the implementation work for the user story in **EPIC 11 — DevOps & Environment**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] Docker Compose configuration runs Postgres, Qdrant, FastAPI backend, Next.js frontend, and Celery worker.
- [ ] Alembic setup initializes database structure.
- [ ] `seed_demo_data.py` populates a mock organization, standard users, and base documents.
- [ ] CI configuration includes linter checks, test suite, and image build validation.
- [ ] Environmental switch enables toggling Fireworks AI API or local AMD ROCm hardware.

## Technical Tasks
- [ ] Verify and refine main `docker-compose.yml` and `docker-compose.override.yml` configurations
- [ ] Configure Alembic migrations setup and verify initialization workflow (`alembic init` / base setup)
- [ ] Write data seeding script in `infra/scripts/seed_demo_data.py`
- [ ] Implement environment variable profiles and configuration loading in `backend/app/core/config.py`
- [ ] Configure local worker container orchestration
- [ ] Setup OpenAPI schema linting and TypeScript client auto-generation script (e.g., `npx openapi-typescript` or similar package in package.json)
- [ ] Write health check shell scripts and verify clean docker initialization workflow


## Collaborative Roles
*   **DevOps / Backend Developer (Lead):** Build the container definitions in `docker-compose.yml` and `docker-compose.override.yml`. Configure environment files and seed scripts.
*   **Frontend Developer:** Verify local package execution and link hot-reloading configurations.

## Integration Contract
*   **Client Codegen Script (`package.json`):**
    Configure a typescript compilation script:
    `"codegen": "openapi-typescript ../shared/openapi/sentinel-os.yaml --output ./src/types/generated/index.ts"`

## Junior Developer Tips & Pitfalls
1.  **Local vs Cloud Hardware Switch:** To prevent local systems from running out of VRAM, implement a configuration toggle in `.env`. Check the variable on system startup: if true, route embeddings and prompts to hosted inference providers (e.g. Fireworks API); if false, use the local ROCm PyTorch backend device.
2.  **Clean Database Seeding:** Seed files should be idempotent. Check if records exist in Postgres or collections exist in Qdrant before executing inserts, so developers can run `make seed` multiple times without duplicate errors.
\n## Affected Files
- [docker-compose.yml](docker-compose.yml)
- [docker-compose.override.yml](docker-compose.override.yml)
- [infra/scripts/seed_demo_data.py](infra/scripts/seed_demo_data.py)
- [backend/app/core/config.py](backend/app/core/config.py)
- [backend/pyproject.toml](backend/pyproject.toml)

## Dependencies
- None
