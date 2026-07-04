#!/bin/bash
# Sentinel OS - Health Check Script

set -eo pipefail

# Read targeted service parameter (defaults to checking 'backend')
TARGET_SERVICE=${1:-"backend"}

if [ "$TARGET_SERVICE" = "backend" ]; then
  # Check FastAPI backend health check status
  curl -f http://localhost:8000/api/v1/health || exit 1
elif [ "$TARGET_SERVICE" = "qdrant" ]; then
  # Check Qdrant vector database readyz status
  curl -f http://localhost:6333/readyz || exit 1
elif [ "$TARGET_SERVICE" = "postgres" ]; then
  # Check Postgres database server status
  pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-sentinel_db}" || exit 1
else
  echo "Unknown service identifier: $TARGET_SERVICE"
  exit 1
fi

echo "Service $TARGET_SERVICE is healthy!"
exit 0
