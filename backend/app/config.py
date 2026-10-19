"""Application configuration, loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- core ---
    environment: str = "development"  # development | production
    secret_key: str = "CHANGE_ME_IN_PRODUCTION"  # JWT + cookie signing
    debug: bool = False

    # --- database ---
    database_url: str = "postgresql+asyncpg://quran_tracker:CHANGE_ME@localhost:5432/quran_tracker"

    # --- auth ---
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    cookie_secure: bool = False  # set True when serving over HTTPS

    # --- google oauth (placeholders; fill in via env / Secret Manager) ---
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5100/api/auth/google/callback"

    # --- web / cors ---
    frontend_origin: str = "http://localhost:5173"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def ensure_secret_key(self) -> None:
        """Fail fast in production if SECRET_KEY was left at its default."""
        if self.is_production and self.secret_key in ("", "CHANGE_ME_IN_PRODUCTION"):
            raise RuntimeError(
                "SECRET_KEY must be set to a long random value before running in production."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
