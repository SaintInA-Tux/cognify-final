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
    database_url: str = "sqlite+aiosqlite:///./phyprep.db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = False

    # Groq — replaces DeepSeek entirely for prototype
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai"
    groq_model: str = "llama-3.3-70b-versatile"

    @property
    def fast_model(self) -> str:
        return self.groq_model

    @property
    def deepseek_model(self) -> str:
        return self.groq_model

    # MathPix
    mathpix_app_id: str = ""
    mathpix_app_key: str = ""

    # Cache TTLs (seconds)
    classification_cache_ttl: int = 86400
    hint_session_ttl: int = 3600

    @property
    def database_url_async(self) -> str:
        """SQLAlchemy async engine expects postgresql+asyncpg:// but Render gives postgres://"""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

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
    settings.validate_production_readiness()
    return settings
