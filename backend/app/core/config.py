from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings defined using Pydantic Settings.
    Environment variables are automatically mapped and typed.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # General configuration
    PROJECT_NAME: str = "AREX"
    API_V1_STR: str = "/api/v1"

    # -----------------------------------------------------------------------
    # AI Mode Configuration
    # Set AI_MODE=developer → Google Gemini for LLM + embeddings
    # Set AI_MODE=hackathon → Fireworks AI for LLM + embeddings
    # Set AI_MODE=offline   → deterministic mock responses (no LLM calls)
    # -----------------------------------------------------------------------
    AI_MODE: str = "developer"

    # CORS Origins - parsed as list or comma-separated string
    CORS_ORIGINS: Union[List[str], str] = []

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    # PostgreSQL Database Settings
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "dev_password"
    POSTGRES_DB: str = "arex_db"
    DATABASE_URL: str = "postgresql://postgres:dev_password@localhost:5432/arex_db"

    # Qdrant Vector DB Settings
    QDRANT_URL: str = "http://localhost:6333"

    # Security & JWT Configuration
    JWT_SECRET: str = "super_secret_jwt_signing_key_change_me_in_production_123456"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"

    # -----------------------------------------------------------------------
    # Gemini API Settings (Online AI Mode)
    # -----------------------------------------------------------------------
    GEMINI_API_KEY: str = ""  # Set via GEMINI_API_KEY env var
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_MODEL_NAME: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # -----------------------------------------------------------------------
    # Fireworks AI Settings (Online AI Mode for LLM completion)
    # -----------------------------------------------------------------------
    FIREWORKS_API_KEY: str = ""
    FIREWORKS_MODEL: str = "accounts/fireworks/models/qwen3-32b"
    FIREWORKS_EMBEDDING_MODEL: str = "nomic-ai/nomic-embed-text-v1.5"

    # -----------------------------------------------------------------------
    # Jira Integration Settings
    # -----------------------------------------------------------------------
    JIRA_URL: str = ""
    JIRA_EMAIL: str = ""
    JIRA_API_TOKEN: str = ""
    JIRA_PROJECT_KEY: str = ""

    # -----------------------------------------------------------------------
    # Legacy / Fallback LLM Settings (OpenAI-compatible providers)
    # These are used if GEMINI_API_KEY is not set but AI_MODE=online.
    # -----------------------------------------------------------------------
    LLM_API_KEY: str = "your_llm_provider_api_key_here"
    LLM_API_BASE: str = "https://api.fireworks.ai/inference/v1"
    LLM_MODEL_NAME: str = "accounts/fireworks/models/qwen2p5-72b-instruct"
    EMBEDDING_API_KEY: str = "your_embedding_api_key_here"
    EMBEDDING_MODEL_NAME: str = "BAAI/bge-large-en-v1.5"

    @property
    def is_online_mode(self) -> bool:
        """Returns True if AI_MODE is set to 'online', 'developer', or 'hackathon'."""
        mode = self.AI_MODE.strip().lower()
        return mode in ("online", "developer", "hackathon")

    @property
    def effective_gemini_key(self) -> str:
        """Returns the active Gemini API key, falling back to LLM_API_KEY."""
        if self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip():
            return self.GEMINI_API_KEY.strip()
        # Fallback: try using LLM_API_KEY if it looks like a Google key
        if self.LLM_API_KEY and "your_llm_provider" not in self.LLM_API_KEY:
            return self.LLM_API_KEY.strip()
        return ""

    @property
    def fireworks_model_formatted(self) -> str:
        model_path = self.FIREWORKS_MODEL
        if not model_path:
            return ""
        last_part = model_path.split("/")[-1]
        parts = last_part.split("-")
        formatted_parts = []
        for p in parts:
            if p.lower() in ("32b", "72b", "7b", "8b", "14b", "70b"):
                formatted_parts.append(p.upper())
            elif p.lower().startswith("qwen"):
                formatted_parts.append(p.capitalize())
            else:
                formatted_parts.append(p.capitalize())
        return "-".join(formatted_parts)

    @property
    def active_provider(self) -> str:
        mode = self.AI_MODE.strip().lower()
        if mode == "developer":
            return "Google Gemini"
        elif mode == "hackathon":
            return "Fireworks AI"
        return "Offline Mode"

    @property
    def active_model_formatted(self) -> str:
        mode = self.AI_MODE.strip().lower()
        if mode == "developer":
            return self.GEMINI_MODEL
        elif mode == "hackathon":
            return self.fireworks_model_formatted
        return "Mock Model"


settings = Settings()
