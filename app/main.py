"""
PhyPrep Backend — V1 MVP
FastAPI application entry point.
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.cache.redis_client import close_redis, get_redis
from app.config import get_settings
from app.database.db import create_tables

from app.utils.rate_limiter import limiter

logging.basicConfig(
    level=logging.DEBUG if get_settings().debug else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting PhyPrep V1 backend...")
    await create_tables()
    logger.info("Database tables ready.")
    if settings.redis_enabled:
        await get_redis()
    else:
        logger.info("Redis disabled — running without cache (set REDIS_ENABLED=true to enable)")
    yield
    logger.info("Shutting down...")
    await close_redis()


app = FastAPI(
    title="PhyPrep API",
    description=(
        "The AI Math Thinking Engine for JEE Aspirants. "
        "V1 MVP — Brain Mode, SOS Mode, Progressive Hints, "
        "Mistake Detection, Weakness Dashboard."
    ),
    version="1.0.0",
    docs_url="/docs" if not (os.environ.get("APP_ENV") == "production") else None,
    redoc_url="/redoc" if not (os.environ.get("APP_ENV") == "production") else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://phyprep-final.vercel.app",
        "https://phyprep-final-saintina-tuxs-projects.vercel.app",
        "https://phyprep-web.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

MAX_REQUEST_SIZE = 1048576 * 5  # 5 MB


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    if request.headers.get("content-length"):
        content_length = int(request.headers.get("content-length", 0))
        if content_length > MAX_REQUEST_SIZE:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request body too large. Maximum size is 5 MB."},
            )
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Please try again."},
    )



from app.routes import ask, hints, practice, solution, auth, chats, challenge

app.include_router(ask.router, prefix="/v1")
app.include_router(hints.router, prefix="/v1")
app.include_router(solution.router, prefix="/v1")
app.include_router(practice.router, prefix="/v1")
app.include_router(auth.router, prefix="/v1")
app.include_router(chats.router, prefix="/v1")
app.include_router(challenge.router, prefix="/v1")


@app.get("/health", tags=["Meta"])
async def health() -> dict:
    return {
        "status": "ok",
        "version": "1.0.0",
        "database": "sqlite" if settings.database_url.startswith("sqlite") else "postgresql",
        "redis": "enabled" if settings.redis_enabled else "disabled",
    }


@app.get("/", tags=["Meta"])
async def root() -> dict:
    return {"product": "PhyPrep", "version": "1.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
