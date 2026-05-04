from pathlib import Path

from data import generator


ROOT = Path(__file__).resolve().parents[2]


def test_initial_schema_declares_timescale_postgis_and_hypertables():
    schema_path = ROOT / "backend" / "migrations" / "001_initial_schema.sql"
    sql = schema_path.read_text()
    normalized = " ".join(sql.lower().split())

    assert "create extension if not exists timescaledb" in normalized
    assert "create extension if not exists postgis" in normalized
    assert "create table if not exists meter_readings" in normalized
    assert "create table if not exists feeder_readings" in normalized
    assert "create table if not exists meters" in normalized
    assert "create table if not exists feeders" in normalized
    assert "create table if not exists alerts" in normalized
    assert "create_hypertable('meter_readings', 'timestamp'" in normalized
    assert "create_hypertable('feeder_readings', 'timestamp'" in normalized
    assert "create materialized view if not exists meter_readings_15min" in normalized


def test_migration_runner_discovers_sorted_sql_files():
    from backend.scripts.run_migrations import discover_migrations

    migrations = discover_migrations(ROOT / "backend" / "migrations")

    assert [path.name for path in migrations] == ["001_initial_schema.sql"]


def test_seed_payload_matches_generated_csv_contract(tmp_path):
    from backend.scripts.seed_database import build_seed_payload

    generator.generate_data(output_dir=tmp_path)

    payload = build_seed_payload(tmp_path)

    assert len(payload.meter_readings) == 13_440
    assert len(payload.feeder_readings) == 672
    assert len(payload.meters) == 20
    assert payload.feeders == [("F001",)]
    assert {row[2] for row in payload.meter_readings} == {"F001"}
    assert all(len(row) == 5 for row in payload.meter_readings)
    assert all(len(row) == 3 for row in payload.feeder_readings)
    assert all(row[1] == "F001" for row in payload.meters)
    assert all(row[2] is not None and row[3] is not None for row in payload.meters)


def test_health_check_reports_csv_mode_when_database_not_configured(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    from app.main import health_check

    payload = health_check()

    assert payload["status"] == "ok"
    assert payload["data_source"] == "csv"
    assert payload["database"]["status"] == "disabled"
