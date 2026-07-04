# Sentinel OS

Sentinel OS is a regulatory intelligence platform designed to automate and streamline compliance mapping for **FDA 21 CFR Part 11**.

## Tech Stack
- **Backend**: FastAPI (Python 3.10+), SQLAlchemy (PostgreSQL)
- **AI Orchestration**: LangGraph, Qwen3 8B LLM, BGE-M3 Embeddings
- **Vector Search**: Qdrant Vector Database
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, React, TypeScript
- **Infrastructure**: Docker Compose, PostgreSQL, Qdrant

## Directory Layout
- `backend/`: FastAPI application, database models, LangGraph AI orchestration layer, and celery background workers.
- `frontend/`: Next.js frontend application with dashboard, document manager, regulatory updates feed, and remediation diff views.
- `shared/`: Shared API models/contracts (OpenAPI specs) and global constants.
- `infra/`: Docker configurations, seeding scripts, health checks, and database migrations.
- `docs/`: Product architecture decision records (ADRs), API spec files, and regulatory tracing matrix.

## Quick-Start Instructions

### Prerequisites
- Docker & Docker Compose
- Python 3.10+ (for local development)
- Node.js 18+ (for frontend development)

### Getting Started

1. **Clone & Setup Environment**
   ```bash
   cp .env.example .env
   # Update environment variables in .env as needed
   ```

2. **Spin Up Services**
   Use the Makefile targets:
   ```bash
   make up
   ```
   This will spin up PostgreSQL, Qdrant, FastAPI backend, and Next.js frontend services in Docker.

3. **Database Setup & Seed Data**
   Seed mock data (organizations, sample FDA guidances) into Postgres & Qdrant:
   ```bash
   make seed
   ```

4. **Running Tests & Linter**
   ```bash
   make test
   make lint
   ```

## Development
- Detailed architecture and design decisions can be found under `docs/architecture/system-architecture.md`.
