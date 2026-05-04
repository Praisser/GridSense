# GridSense Database Schema

Round 2 adds an optional TimescaleDB/PostGIS storage layer while keeping the CSV
demo path available by default.

## Services

`docker-compose.yml` defines one database service:

- `timescaledb`: PostgreSQL 15 with TimescaleDB and PostGIS installed.
- Persistent data directory: `data/timescale_data/`.
- Default database: `gridsense`.
- Default host port: `5432` (override with `POSTGRES_PORT=55432` if another
  local PostgreSQL is already bound to 5432).

Copy `.env.example` to `.env` if you want to override credentials.

## Tables

### `feeders`

Stores feeder metadata. `feeder_id` is the primary key. Optional
`substation_location` uses PostGIS `GEOGRAPHY(POINT, 4326)`.

### `meters`

Stores one row per meter. `meter_id` is the primary key, `feeder_id` references
`feeders`, and `location` stores the meter point as PostGIS geography.

### `meter_readings`

Timescale hypertable partitioned by `timestamp`.

- Primary key: `(timestamp, meter_id)`
- Indexed by `(meter_id, timestamp DESC)`
- Indexed by `(feeder_id, timestamp DESC)`
- Includes `quality_flag` for missing or interpolated readings.

### `feeder_readings`

Timescale hypertable partitioned by `timestamp`.

- Primary key: `(timestamp, feeder_id)`
- Indexed by `(feeder_id, timestamp DESC)`

### `alerts`

Stores ranked detection results and workflow status.

- `status`: `open`, `inspecting`, `resolved`, or `dismissed`
- `confidence`, `composite_score`, `iso_score`, `lstm_score`, and `gap_score`
  preserve the scoring components for later audits.

## Continuous Aggregate

`meter_readings_15min` pre-aggregates meter readings into 15-minute buckets. The
view is created with `WITH NO DATA`; refresh it after seeding if you need it for
dashboard queries:

```sql
CALL refresh_continuous_aggregate(
  'meter_readings_15min',
  NULL,
  NULL
);
```

## Commands

```bash
docker compose up -d
python backend/scripts/run_migrations.py
python backend/scripts/seed_database.py --reset
```

If port 5432 is already occupied:

```bash
POSTGRES_PORT=55432 docker compose up -d
DATABASE_URL=postgresql://gridsense:gridsense@localhost:55432/gridsense python backend/scripts/run_migrations.py
DATABASE_URL=postgresql://gridsense:gridsense@localhost:55432/gridsense python backend/scripts/seed_database.py --reset
```
