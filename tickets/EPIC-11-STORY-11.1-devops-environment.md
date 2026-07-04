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
- [ ] Setup alembic migration schema structures
- [ ] Write data seeding script in `infra/scripts/seed_demo_data.py`
- [ ] Implement environment variable profiles and configuration loading in `backend/app/core/config.py`
- [ ] Configure local worker container orchestration
- [ ] Write health check shell scripts and verify clean docker initialization workflow

## Affected Files
- [docker-compose.yml](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/docker-compose.yml)
- [docker-compose.override.yml](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/docker-compose.override.yml)
- [seed_demo_data.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/infra/scripts/seed_demo_data.py)
- [config.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/core/config.py)
- [pyproject.toml](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/pyproject.toml)

## Dependencies
- None
