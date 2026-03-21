from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Core
    app_env: str = "development"
    debug: bool = False
    secret_key: str = ""  # MUST be set in .env

    # Database
    # Default: SQLite (zero setup, works on Windows with no install)
    # For production: postgresql+asyncpg://user:pass@localhost:5432/cognify
    database_url: str = "sqlite+aiosqlite:///./cognify.db"

    # Redis
    # Default: disabled — set to redis://localhost:6379/0 when Redis is running
    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = False   # set to true in .env when Redis is running

    # Models
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-reasoner"
    fast_model: str = "llama-3.3-70b-versatile"

    # MathPix
    mathpix_app_id: str = ""
    mathpix_app_key: str = ""

    # Cache TTLs (seconds)
    classification_cache_ttl: int = 86400
    hint_session_ttl: int = 3600

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    def validate_production_readiness(self) -> None:
        if not self.secret_key or self.secret_key == "changeme":
            raise ValueError("SECRET_KEY must be set to a secure random string (cannot be empty or 'changeme')")
        if self.is_production and self.database_url.startswith("sqlite"):
            raise ValueError("SQLite is not supported in production. Set DATABASE_URL to a proper database like PostgreSQL.")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Validate critical settings on startup
    settings.validate_production_readiness()
    return settings
