from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

try:
    from .run_migrations import DEFAULT_DATABASE_URL, run_migrations, sync_database_url
except ImportError:
    from run_migrations import DEFAULT_DATABASE_URL, run_migrations, sync_database_url


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = ROOT / "data"


@dataclass(frozen=True)
class SeedPayload:
    feeders: list[tuple[str]]
    meters: list[tuple[str, str, float, float, float, float]]
    meter_readings: list[tuple[str, str, str, float, int]]
    feeder_readings: list[tuple[str, str, float]]


def build_seed_payload(data_dir: Path = DEFAULT_DATA_DIR, feeder_id: str = "F001") -> SeedPayload:
    meters_df = pd.read_csv(Path(data_dir) / "meters.csv")
    feeder_df = pd.read_csv(Path(data_dir) / "feeder_input.csv")

    unique_meters = (
        meters_df[["meter_id", "lat", "lng"]]
        .drop_duplicates(subset=["meter_id"])
        .sort_values("meter_id")
    )

    meters = [
        (
            row.meter_id,
            feeder_id,
            float(row.lng),
            float(row.lat),
            float(row.lng),
            float(row.lat),
        )
        for row in unique_meters.itertuples(index=False)
    ]
    meter_readings = [
        (row.timestamp, row.meter_id, feeder_id, float(row.kwh), 0)
        for row in meters_df.itertuples(index=False)
    ]
    feeder_readings = [
        (row.timestamp, row.feeder_id, float(row.kwh))
        for row in feeder_df.itertuples(index=False)
    ]
    feeders = [(str(value),) for value in sorted(feeder_df["feeder_id"].unique())]

    return SeedPayload(
        feeders=feeders,
        meters=meters,
        meter_readings=meter_readings,
        feeder_readings=feeder_readings,
    )


def reset_schema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("DROP MATERIALIZED VIEW IF EXISTS meter_readings_15min;")
        cur.execute("DROP TABLE IF EXISTS alerts CASCADE;")
        cur.execute("DROP TABLE IF EXISTS meter_readings CASCADE;")
        cur.execute("DROP TABLE IF EXISTS feeder_readings CASCADE;")
        cur.execute("DROP TABLE IF EXISTS meters CASCADE;")
        cur.execute("DROP TABLE IF EXISTS feeders CASCADE;")


def seed_database(
    database_url: str | None = None,
    data_dir: Path = DEFAULT_DATA_DIR,
    reset: bool = False,
) -> dict[str, int]:
    try:
        import psycopg2
        from psycopg2.extras import execute_values
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "psycopg2-binary is required to seed the database. "
            "Install backend requirements first."
        ) from exc

    url = sync_database_url(database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    if reset:
        with psycopg2.connect(url) as conn:
            reset_schema(conn)
        run_migrations(database_url=url)

    payload = build_seed_payload(data_dir)

    with psycopg2.connect(url) as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO feeders (feeder_id)
                VALUES %s
                ON CONFLICT (feeder_id) DO NOTHING
                """,
                payload.feeders,
            )
            execute_values(
                cur,
                """
                INSERT INTO meters (meter_id, feeder_id, location, metadata)
                VALUES %s
                ON CONFLICT (meter_id) DO UPDATE SET
                    feeder_id = EXCLUDED.feeder_id,
                    location = EXCLUDED.location,
                    metadata = EXCLUDED.metadata
                """,
                payload.meters,
                template=(
                    "(%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, "
                    "jsonb_build_object('lng', %s, 'lat', %s))"
                ),
            )
            execute_values(
                cur,
                """
                INSERT INTO meter_readings
                    (timestamp, meter_id, feeder_id, kwh, quality_flag)
                VALUES %s
                ON CONFLICT (timestamp, meter_id) DO UPDATE SET
                    feeder_id = EXCLUDED.feeder_id,
                    kwh = EXCLUDED.kwh,
                    quality_flag = EXCLUDED.quality_flag
                """,
                payload.meter_readings,
            )
            execute_values(
                cur,
                """
                INSERT INTO feeder_readings (timestamp, feeder_id, kwh)
                VALUES %s
                ON CONFLICT (timestamp, feeder_id) DO UPDATE SET
                    kwh = EXCLUDED.kwh
                """,
                payload.feeder_readings,
            )

    return {
        "feeders": len(payload.feeders),
        "meters": len(payload.meters),
        "meter_readings": len(payload.meter_readings),
        "feeder_readings": len(payload.feeder_readings),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed GridSense TimescaleDB data.")
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    counts = seed_database(
        database_url=args.database_url,
        data_dir=args.data_dir,
        reset=args.reset,
    )
    for name, count in counts.items():
        print(f"{name}: {count}")


if __name__ == "__main__":
    main()
