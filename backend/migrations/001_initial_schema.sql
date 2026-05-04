CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS feeders (
    feeder_id TEXT PRIMARY KEY,
    substation_location GEOGRAPHY(POINT, 4326),
    capacity_kwh DOUBLE PRECISION,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS meters (
    meter_id TEXT PRIMARY KEY,
    feeder_id TEXT NOT NULL REFERENCES feeders(feeder_id),
    location GEOGRAPHY(POINT, 4326),
    installed_at TIMESTAMPTZ,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS meter_readings (
    timestamp TIMESTAMPTZ NOT NULL,
    meter_id TEXT NOT NULL,
    feeder_id TEXT NOT NULL,
    kwh DOUBLE PRECISION NOT NULL,
    quality_flag SMALLINT DEFAULT 0,
    PRIMARY KEY (timestamp, meter_id)
);

SELECT create_hypertable('meter_readings', 'timestamp', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_meter_readings_meter_time
    ON meter_readings (meter_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_meter_readings_feeder_time
    ON meter_readings (feeder_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS feeder_readings (
    timestamp TIMESTAMPTZ NOT NULL,
    feeder_id TEXT NOT NULL,
    kwh DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (timestamp, feeder_id)
);

SELECT create_hypertable('feeder_readings', 'timestamp', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_feeder_readings_feeder_time
    ON feeder_readings (feeder_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id TEXT REFERENCES meters(meter_id),
    detected_at TIMESTAMPTZ NOT NULL,
    loss_type TEXT,
    confidence DOUBLE PRECISION,
    composite_score DOUBLE PRECISION,
    iso_score DOUBLE PRECISION,
    lstm_score DOUBLE PRECISION,
    gap_score DOUBLE PRECISION,
    reasoning TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_meter_detected
    ON alerts (meter_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_status_created
    ON alerts (status, created_at DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS meter_readings_15min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', timestamp) AS bucket,
    meter_id,
    feeder_id,
    AVG(kwh) AS avg_kwh,
    MAX(kwh) AS max_kwh,
    MIN(kwh) AS min_kwh
FROM meter_readings
GROUP BY bucket, meter_id, feeder_id
WITH NO DATA;
