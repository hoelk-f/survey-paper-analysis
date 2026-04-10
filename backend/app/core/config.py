from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "Survey Paper Analysis"
    api_prefix: str = "/api"
    data_dir: Path = BASE_DIR / "data"
    cors_origins: str = "http://localhost:5173"
    max_pdf_chars: int = 0
    default_provider: str = "openai"
    default_model: str = "gpt-4.1-mini"
    request_timeout_seconds: int = 300
    openai_base_url: str = "https://api.openai.com/v1"
    ki4buw_base_url: str = "https://llm.ki4buw.de/v1"
    ki4buw_models: str = "openai/qwen3"
    ki4buw_max_input_tokens: int = 9000
    ki4buw_max_completion_tokens: int = 1024
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    default_temperature: float = 0.1
    elsevier_sciencedirect_search_url: str = "https://api.elsevier.com/content/search/sciencedirect"

    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    def ki4buw_models_list(self) -> list[str]:
        return [item.strip() for item in self.ki4buw_models.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings
