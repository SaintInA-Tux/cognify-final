from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# SQLite does not support pool_size / max_overflow — PostgreSQL-only args.
# Auto-detect dialect from the URL so the same code works for both.
_is_sqlite = settings.database_url.startswith("sqlite")

_engine_kwargs: dict = {"echo": settings.debug}
if not _is_sqlite:
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20
    _engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(settings.database_url_async, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def _ensure_students_schema(conn) -> None:
    if not _is_sqlite:
        return

    result = await conn.execute(text("PRAGMA table_info(students)"))
    existing_cols = {row[1] for row in result.fetchall()}

    # Columns that are in SQLAlchemy model but may be missing in an older SQLite file.
    missing_columns = []
    if "is_guest" not in existing_cols:
        missing_columns.append("is_guest BOOLEAN NOT NULL DEFAULT 0")
    if "onboarded" not in existing_cols:
        missing_columns.append("onboarded BOOLEAN NOT NULL DEFAULT 0")
    if "daily_goal" not in existing_cols:
        missing_columns.append("daily_goal INTEGER NOT NULL DEFAULT 5")
    if "streak" not in existing_cols:
        missing_columns.append("streak INTEGER NOT NULL DEFAULT 0")

    for col_def in missing_columns:
        await conn.execute(text(f"ALTER TABLE students ADD COLUMN {col_def}"))


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_students_schema(conn)
