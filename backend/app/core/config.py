from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    env: Literal["dev", "test", "prod"] = "dev"

    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str = "db"
    postgres_port: int = 5432

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 7

    cors_origins: str = "http://localhost:5173"

    media_dir: str = "/app/media"
    media_base_url: str = "/media"

    ai_provider: Literal["mock", "comfyui", "ollama"] = "mock"

    llm_base_url: str = "http://192.168.88.45:8050/v1"
    llm_api_key: str = ""
    llm_model: str = "current-LLM"
    llm_timeout_sec: int = 60

    comfyui_base_url: str = "http://host.docker.internal:8188"
    comfyui_timeout_sec: int = 300
    comfyui_poll_interval_sec: float = 1.5

    superadmin_email: str
    superadmin_password: str = Field(min_length=8)

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
