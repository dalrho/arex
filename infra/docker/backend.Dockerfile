FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.7.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

# Install curl for health check scripts and gcc/libpq-dev for compiled dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install "poetry==$POETRY_VERSION"

# Set working directory to /app
WORKDIR /app

# Copy configuration and dependency manifest
COPY backend/pyproject.toml backend/poetry.lock* ./

# Install python dependencies
RUN poetry install --no-root

# Install google-genai (Gemini AI SDK) and fireworks-ai (Fireworks AI SDK) — required for Online AI Mode
RUN pip install google-genai fireworks-ai

# Copy application code to workspace
COPY backend/app ./app

# Expose FastAPI server port
EXPOSE 8000

# Default command for local dev container run (overridden for production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
