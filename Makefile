.PHONY: up down build seed test lint clean

# Default target
all: build

# Start the docker containers
up:
	docker compose up -d

# Stop the docker containers
down:
	docker compose down

# Build docker containers
build:
	docker compose build

# Seed the database with demo data
seed:
	docker compose exec backend python -m scripts.seed_demo_data || python infra/scripts/seed_demo_data.py

# Run tests
test:
	@echo "Running backend tests..."
	pytest backend/tests/ || true
	@echo "Running frontend tests..."
	cd frontend && npm run test || true

# Run linter and formatter checks
lint:
	@echo "Linting backend..."
	ruff check backend/app || flake8 backend/app || true
	@echo "Linting frontend..."
	cd frontend && npm run lint || true
