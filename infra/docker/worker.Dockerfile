FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.7.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

# Install dependencies (curl for checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install "poetry==$POETRY_VERSION"

# Set working directory to /app
WORKDIR /app

# Copy dependency definition manifest
COPY backend/pyproject.toml ./

# Install python dependencies
RUN poetry install --no-root

# Copy application code
COPY backend/app ./app

# Run background Celery worker (placeholder for async compliance jobs)
CMD ["python", "-m", "app.workers.celery_app"]
