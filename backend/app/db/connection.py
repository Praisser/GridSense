from __future__ import annotations

import os
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def async_database_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgres://")
    return url


def sync_database_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + url.removeprefix("postgresql+asyncpg://")
    if url.startswith("postgres+asyncpg://"):
        return "postgresql://" + url.removeprefix("postgres+asyncpg://")
    if url.startswith("postgres://"):
        return "postgresql://" + url.removeprefix("postgres://")
    return url


def configured_database_url() -> str | None:
    return os.getenv("ASYNC_DATABASE_URL") or os.getenv("DATABASE_URL")


def database_is_configured(url: str | None = None) -> bool:
    candidate = url if url is not None else configured_database_url()
    return bool(candidate and not candidate.startswith("sqlite"))


def _create_session_factory() -> async_sessionmaker[AsyncSession] | None:
    url = configured_database_url()
    if not database_is_configured(url):
        return None

    engine = create_async_engine(async_database_url(url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False)


async_session_factory = _create_session_factory()


async def get_session() -> AsyncIterator[AsyncSession]:
    if async_session_factory is None:
        raise RuntimeError("DATABASE_URL is not configured for database access")

    async with async_session_factory() as session:
        yield session


def check_database_connection() -> dict[str, Any]:
    url = os.getenv("DATABASE_URL") or os.getenv("ASYNC_DATABASE_URL")
    if not database_is_configured(url):
        return {
            "status": "disabled",
            "configured": False,
            "detail": "CSV data source is active.",
        }

    try:
        import psycopg2
    except ModuleNotFoundError:
        return {
            "status": "unavailable",
            "configured": True,
            "detail": "psycopg2-binary is not installed.",
        }

    try:
        with psycopg2.connect(sync_database_url(url), connect_timeout=2) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
    except Exception as exc:
        return {
            "status": "error",
            "configured": True,
            "detail": str(exc),
        }

    return {
        "status": "ok",
        "configured": True,
        "detail": "Database connection verified.",
    }


async def check_database_connection_async() -> dict[str, Any]:
    if async_session_factory is None:
        return {
            "status": "disabled",
            "configured": False,
            "detail": "CSV data source is active.",
        }

    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        return {
            "status": "error",
            "configured": True,
            "detail": str(exc),
        }

    return {
        "status": "ok",
        "configured": True,
        "detail": "Database connection verified.",
    }
