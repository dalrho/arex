import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import LLMConfigurationError
from fastapi.responses import JSONResponse
from fastapi import Request

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("arex")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Regulatory compliance intelligence platform for FDA 21 CFR Part 11",
    version="1.0.0",
)

@app.exception_handler(LLMConfigurationError)
async def llm_configuration_exception_handler(request: Request, exc: LLMConfigurationError):
    return JSONResponse(
        status_code=503,
        content={"detail": "No LLM provider configured. Configure an API key to use AI features."},
    )

# CORS middleware mapping from configuration settings
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include core API routes under versioned prefix
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["health"])
async def health_check():
    """
    Simple health check endpoint to verify backend service viability.
    """
    return {"status": "healthy", "service": "arex-backend", "version": "1.0.0"}
