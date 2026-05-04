from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable


DEFAULT_DATABASE_URL = "postgresql://gridsense:gridsense@localhost:5432/gridsense"
DEFAULT_MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


def discover_migrations(migrations_dir: Path = DEFAULT_MIGRATIONS_DIR) -> list[Path]:
    return sorted(Path(migrations_dir).glob("*.sql"))


def sync_database_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + url.removeprefix("postgresql+asyncpg://")
    if url.startswith("postgres+asyncpg://"):
        return "postgresql://" + url.removeprefix("postgres+asyncpg://")
    if url.startswith("postgres://"):
        return "postgresql://" + url.removeprefix("postgres://")
    return url


def run_migrations(
    database_url: str | None = None,
    migrations: Iterable[Path] | None = None,
) -> list[str]:
    try:
        import psycopg2
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "psycopg2-binary is required to run migrations. "
            "Install backend requirements first."
        ) from exc

    url = sync_database_url(database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    migration_paths = list(migrations or discover_migrations())
    applied: list[str] = []

    with psycopg2.connect(url) as conn:
        with conn.cursor() as cur:
            for path in migration_paths:
                cur.execute(path.read_text())
                applied.append(path.name)

    return applied


def main() -> None:
    applied = run_migrations()
    if not applied:
        print("No migrations found.")
        return
    print("Applied migrations:")
    for name in applied:
        print(f"- {name}")


if __name__ == "__main__":
    main()
