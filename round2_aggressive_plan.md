# GridSense Round 2 — Production Stack & Feature Completion

> **Mission:** Add all five originally-excluded pieces — Kafka, TimescaleDB, PostGIS, Neighborhood Correlation, and Time-Pattern Analysis — to the existing prototype within 14 days, solo.
>
> **Stance:** This is aggressive. There is no slack. Every phase has an explicit "if behind, cut this" instruction. Honor those — shipping a working subset beats shipping a broken whole.
>
> **Pre-requisite:** The Day 1-5 prototype + Day 2.5 LSTM + design revamp are all complete and stable. This plan assumes a clean, finalized starting point.

---

## Cardinal Rules for This Sprint

1. **The current prototype must keep working at all times.** Every change goes behind a feature flag or is added in parallel until verified. You don't break the demo you already have.
2. **One commit per working state.** If something works, commit. If it breaks, you can roll back.
3. **Daily integration test.** End every day with the full demo flow running. If it doesn't, you stop and fix before adding anything new.
4. **No new features after Day 11.** Days 12-14 are integration, polish, video.
5. **Cut ruthlessly.** If a phase exceeds its budget by 50%, drop the lowest-value remaining task in that phase.

---

## Daily Time Budget

- **8-10 focused hours per day** for 14 days
- **Sleep is non-negotiable** — fatigue creates bugs that cost more time than they save
- **One half-day off** somewhere in the middle (recommend Day 7) — protect this

---

## High-Level Schedule

| Days | Focus | Risk Level |
|------|-------|------------|
| 1-3 | TimescaleDB migration | Medium |
| 4-5 | PostGIS + spatial layer | Low-Medium |
| 6-7 | Kafka + streaming ingestion | **HIGH** |
| 8-9 | Neighborhood Correlation feature | Medium |
| 10-11 | Time-Pattern Analysis feature | Low-Medium |
| 12 | Full integration + regression | Medium |
| 13 | UI polish + new screenshots + ablation | Low |
| 14 | New 5-min video + final submission | Low |

---

# Day 1 — TimescaleDB Setup & Schema

**Goal:** TimescaleDB running locally via Docker, schema designed, raw meter data migrated from CSV to hypertables.

**Time budget:** 8-9 hours

## Phase 1.1 — Docker Compose Setup (1.5 hr)

### Tasks
1. Create `docker-compose.yml` at repo root with services:
   - `timescaledb` (image: `timescale/timescaledb:latest-pg15`)
   - `postgis` extension installed in same container
   - Persistent volume mount: `./data/timescale_data`
   - Port: `5432`
   - Env: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
2. Add `.env.example` with DB connection vars (commit example, gitignore real `.env`)
3. Verify: `docker compose up -d` brings DB online; `docker exec` lets you run psql

### Acceptance criteria
- [ ] `docker compose up -d` succeeds
- [ ] `psql` connects from host machine
- [ ] TimescaleDB extension available: `SELECT * FROM pg_extension WHERE extname='timescaledb'`

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T1.1.1 | `docker compose up -d` | Both services healthy |
| T1.1.2 | Connect with psql | Successful login |
| T1.1.3 | Restart container | Data persists |

---

## Phase 1.2 — Schema Design (2 hr)

### Tables to create

```sql
-- Hypertable for time-series meter readings
CREATE TABLE meter_readings (
    timestamp    TIMESTAMPTZ NOT NULL,
    meter_id     TEXT NOT NULL,
    feeder_id    TEXT NOT NULL,
    kwh          DOUBLE PRECISION NOT NULL,
    quality_flag SMALLINT DEFAULT 0  -- 0=ok, 1=missing, 2=interpolated
);
SELECT create_hypertable('meter_readings', 'timestamp');
CREATE INDEX ON meter_readings (meter_id, timestamp DESC);
CREATE INDEX ON meter_readings (feeder_id, timestamp DESC);

-- Hypertable for feeder readings
CREATE TABLE feeder_readings (
    timestamp  TIMESTAMPTZ NOT NULL,
    feeder_id  TEXT NOT NULL,
    kwh        DOUBLE PRECISION NOT NULL
);
SELECT create_hypertable('feeder_readings', 'timestamp');

-- Standard tables (not hypertables)
CREATE TABLE meters (
    meter_id     TEXT PRIMARY KEY,
    feeder_id    TEXT NOT NULL,
    location     GEOGRAPHY(POINT, 4326),  -- PostGIS column, populated Day 4
    installed_at TIMESTAMPTZ,
    metadata     JSONB
);

CREATE TABLE feeders (
    feeder_id    TEXT PRIMARY KEY,
    substation_location GEOGRAPHY(POINT, 4326),
    capacity_kwh DOUBLE PRECISION,
    metadata     JSONB
);

CREATE TABLE alerts (
    alert_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id     TEXT REFERENCES meters(meter_id),
    detected_at  TIMESTAMPTZ NOT NULL,
    loss_type    TEXT,
    confidence   DOUBLE PRECISION,
    composite_score DOUBLE PRECISION,
    iso_score    DOUBLE PRECISION,
    lstm_score   DOUBLE PRECISION,
    gap_score    DOUBLE PRECISION,
    reasoning    TEXT,
    status       TEXT DEFAULT 'open',  -- open, inspecting, resolved, dismissed
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Continuous aggregate for fast dashboard queries
CREATE MATERIALIZED VIEW meter_readings_15min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', timestamp) AS bucket,
    meter_id,
    feeder_id,
    AVG(kwh) AS avg_kwh,
    MAX(kwh) AS max_kwh,
    MIN(kwh) AS min_kwh
FROM meter_readings
GROUP BY bucket, meter_id, feeder_id;
```

### Tasks
1. Write `backend/migrations/001_initial_schema.sql`
2. Write a simple migration runner: `backend/scripts/run_migrations.py`
3. Apply migration; verify all tables and hypertables exist
4. Document schema in `docs/database_schema.md`

### Acceptance criteria
- [ ] All tables created
- [ ] `meter_readings` and `feeder_readings` are hypertables (verify via `SELECT * FROM timescaledb_information.hypertables`)
- [ ] Continuous aggregate exists
- [ ] Migration runner is idempotent (run twice → no error)

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T1.2.1 | Run migration on empty DB | All tables created |
| T1.2.2 | Run migration twice | No error, no duplicates |
| T1.2.3 | Insert 1000 rows into meter_readings | Succeeds, query returns 1000 |
| T1.2.4 | Hypertable check | Both time-series tables registered |

---

## Phase 1.3 — Data Migration from CSV (2.5 hr)

### Tasks
1. Write `backend/scripts/seed_database.py`:
   - Reads existing `data/meters.csv` and `data/feeder_input.csv`
   - Inserts into TimescaleDB using `psycopg2` `execute_values` (batch insert)
   - Populates `meters` table from unique meter IDs + lat/lng
   - Populates `feeders` table
2. Add `--reset` flag to drop and recreate
3. Verify row counts post-import match CSVs

### Acceptance criteria
- [ ] All 13,440 meter readings imported
- [ ] All 672 feeder readings imported
- [ ] All 20 meters in `meters` table with lat/lng
- [ ] Import completes in < 30 seconds

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T1.3.1 | Run seed script on empty DB | All data imported |
| T1.3.2 | Run with `--reset` | DB cleaned, then reimported |
| T1.3.3 | Query: `SELECT COUNT(*) FROM meter_readings` | 13,440 |
| T1.3.4 | Query: `SELECT COUNT(DISTINCT meter_id) FROM meter_readings` | 20 |

---

## Phase 1.4 — Database Access Layer (1.5 hr)

### Tasks
1. Add `sqlalchemy` and `asyncpg` to requirements
2. Create `backend/app/db/` module:
   - `connection.py` — async session management
   - `models.py` — SQLAlchemy models matching schema
   - `repositories/meter_repo.py` — CRUD for meters/readings
   - `repositories/alert_repo.py` — CRUD for alerts
3. Create connection pool, dependency-injected into FastAPI routes
4. Health check endpoint extended to verify DB connectivity

### Acceptance criteria
- [ ] FastAPI starts and connects to DB
- [ ] `/health` returns DB status
- [ ] Repository functions work in isolation (unit-testable)

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T1.4.1 | Start backend with DB up | Connects successfully |
| T1.4.2 | Start backend with DB down | Logs error, returns 503 on /health |
| T1.4.3 | Repository: get_meter('M07') | Returns meter object |
| T1.4.4 | Repository: get_readings(meter_id, start, end) | Returns filtered list |

---

## Day 1 Definition of Done

- [ ] TimescaleDB running in Docker
- [ ] Schema migrated
- [ ] CSV data loaded into hypertables
- [ ] FastAPI connects to DB via repository pattern
- [ ] Existing CSV-based code paths still work (parallel mode — feature flag)
- [ ] All T1.x tests pass
- [ ] Commit: `feat(day1): timescaledb foundation`

### If behind by end of Day 1
**Cut:** the continuous aggregate (Phase 1.2). Add it later if time permits — it's an optimization, not a requirement.

---

# Day 2 — Migrate Existing Pipeline to TimescaleDB

**Goal:** All existing endpoints (alerts, readings, forecasts) now read from TimescaleDB instead of pandas in-memory.

**Time budget:** 8 hours

## Phase 2.1 — Rewrite Data Access (3 hr)

### Tasks
1. Update `gap_detector.py`:
   - Replace pandas DataFrame loading with SQL query against `meter_readings` and `feeder_readings`
   - Use TimescaleDB's `time_bucket` for 15-min aggregation
2. Update `meter_scorer.py` (Isolation Forest):
   - Pull historical data via SQL
   - Cache feature DataFrames per meter (Redis-style — but use simple dict cache for now)
3. Update `lstm_forecaster.py`:
   - Pull baseline + recent windows via SQL
   - Re-train models against DB-sourced data (verify outputs match prior runs)

### Acceptance criteria
- [ ] All detection modules read from TimescaleDB
- [ ] Detection results match the CSV-based version (within floating-point tolerance)
- [ ] Pipeline runs in < 10 seconds

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T2.1.1 | Run detection pipeline | Same M07, M13, M15-M18 flagged |
| T2.1.2 | Compare composite scores DB vs CSV | Within 0.5% tolerance |
| T2.1.3 | Pipeline timing | < 10 seconds |
| T2.1.4 | Toggle CSV vs DB feature flag | Both produce identical results |

---

## Phase 2.2 — Endpoint Migration (2.5 hr)

### Tasks
1. Update all `/api/*` endpoints to use repository layer
2. Remove direct pandas references from route handlers
3. Add query optimization: use continuous aggregates where possible
4. Verify all existing T1.x-T4.x tests still pass

### Acceptance criteria
- [ ] All endpoints respond < 1 sec (p95)
- [ ] No regressions in existing tests
- [ ] Query plans use indexes (verify with `EXPLAIN ANALYZE`)

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T2.2.1 | GET `/api/alerts` from DB | Same response shape as before |
| T2.2.2 | GET `/api/feeder/F001/readings?start=&end=` | Filtered correctly via SQL |
| T2.2.3 | GET `/api/meters/M07/forecast` | Returns from DB-backed pipeline |
| T2.2.4 | All previous T-suite | Pass |

---

## Phase 2.3 — Persistent Alerts Storage (1.5 hr)

### Tasks
1. Detection pipeline now writes alerts to `alerts` table (not just in-memory)
2. Add alert lifecycle endpoints:
   - `POST /api/alerts/{id}/inspect` — mark as inspecting
   - `POST /api/alerts/{id}/resolve` — mark as resolved
   - `POST /api/alerts/{id}/dismiss` — mark as false positive
3. Frontend wired to call these instead of just logging to console

### Acceptance criteria
- [ ] Alerts persist across backend restarts
- [ ] Detail drawer action buttons now work for real
- [ ] Status changes reflected in alert feed

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T2.3.1 | Detect alert → restart backend | Alert still in feed |
| T2.3.2 | Mark alert as resolved | Removed from active feed |
| T2.3.3 | Dismiss alert → re-detect | Doesn't reappear (or reappears with note) |

---

## Phase 2.4 — End-of-Day Regression (1 hr)

- Run full T1-T4 + T2.5 suite
- Verify demo flow end-to-end
- Commit: `feat(day2): full pipeline on timescaledb`

### If behind by end of Day 2
**Cut:** persistent alerts storage (Phase 2.3). Keep alerts in-memory; add persistence later if time permits.

---

# Day 3 — TimescaleDB Buffer Day

**Goal:** Reserved for the inevitable issues with Days 1-2. If everything is on track, use this day to add TimescaleDB-specific optimizations.

**If on track:**
- Implement continuous aggregate refresh policies
- Add data retention policies (drop readings older than 90 days)
- Add compression policies for older chunks
- Performance benchmark: 1M rows insert speed, query latency

**If behind:**
- Catch up on Days 1-2 work
- Cut anything not yet done that isn't strictly required

### Day 3 Definition of Done
- [ ] All Day 1-2 work committed and tested
- [ ] Demo flow runs reliably
- [ ] Decision made on optimizations (done or skipped)

---

# Day 4 — PostGIS Integration

**Goal:** Add spatial intelligence layer. Meters have real geographic indexing, neighborhood queries are fast.

**Time budget:** 8 hours

## Phase 4.1 — Enable PostGIS + Populate Locations (1.5 hr)

### Tasks
1. Verify PostGIS extension is enabled (came with timescaledb image)
2. Update `meters` table to populate `location` GEOGRAPHY column from existing lat/lng
3. Create spatial index: `CREATE INDEX ON meters USING GIST (location)`
4. Update seed script to populate location during initial load

### Acceptance criteria
- [ ] All 20 meters have populated `location` column
- [ ] Spatial index created
- [ ] Test query: `ST_Distance` between two meters returns reasonable meters

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T4.1.1 | `SELECT ST_AsText(location) FROM meters WHERE meter_id='M07'` | Returns POINT(...) |
| T4.1.2 | Spatial index exists | Listed in pg_indexes |
| T4.1.3 | `ST_DWithin` query within 100m of M07 | Returns nearby meters |

---

## Phase 4.2 — Spatial Repository Layer (2 hr)

### Tasks
1. Add to `meter_repo.py`:
   - `get_neighbors(meter_id, radius_meters)` — meters within X meters
   - `get_meters_in_bbox(min_lat, min_lng, max_lat, max_lng)` — for map viewport queries
   - `get_meters_within_distance_of_point(lat, lng, radius)` — for click-to-search
2. Use PostGIS `ST_DWithin` for performance (not bare distance comparison)
3. Add to `feeder_repo.py`:
   - `get_meters_for_feeder(feeder_id)` with spatial info

### Acceptance criteria
- [ ] All spatial queries return correctly
- [ ] Queries < 100ms even with 10,000 simulated meters

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T4.2.1 | `get_neighbors('M07', 100)` | Returns 2-5 nearby meters |
| T4.2.2 | `get_neighbors('M07', 0)` | Returns just M07 |
| T4.2.3 | `get_neighbors('M07', 10000)` | Returns all 20 meters |
| T4.2.4 | Bbox query covering Bengaluru | Returns all 20 |
| T4.2.5 | Bbox query in Antarctica | Returns 0 |

---

## Phase 4.3 — New Spatial Endpoints (2 hr)

### Tasks
1. Add `GET /api/meters/{meter_id}/neighbors?radius=<meters>` — list of nearby meters with their alert status
2. Add `GET /api/feeder/{feeder_id}/topology` — spatial topology with meter positions and risk overlay
3. Add `GET /api/spatial/heatmap?bbox=...&time_window=...` — risk heat data for map heatmap layer
4. Update existing alert endpoint to include neighbor count and "neighbors_with_alerts" count

### Acceptance criteria
- [ ] All new endpoints return < 500ms
- [ ] Frontend heatmap can use `/api/spatial/heatmap` instead of computing client-side

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T4.3.1 | GET `/api/meters/M07/neighbors?radius=200` | Returns array with meter info |
| T4.3.2 | GET `/api/feeder/F001/topology` | Returns full feeder spatial graph |
| T4.3.3 | GET `/api/spatial/heatmap` with valid bbox | Returns grid of risk values |

---

## Phase 4.4 — Test & Commit (2.5 hr)

- Full regression
- Commit: `feat(day4): postgis spatial layer`

### Day 4 Definition of Done
- [ ] PostGIS active, indexed
- [ ] Spatial queries working
- [ ] New endpoints serving spatial data
- [ ] Frontend can consume spatial endpoints (even if UI not yet updated)

### If behind
**Cut:** the heatmap server-side endpoint. Frontend already has client-side heatmap. Keep PostGIS for the neighborhood correlation feature in Day 8.

---

# Day 5 — PostGIS Integration into UI

**Goal:** Map and detail drawer now show real spatial intelligence.

**Time budget:** 7-8 hours

## Phase 5.1 — Map Improvements (3 hr)

### Tasks
1. Update map to fetch markers via spatial bbox endpoint (only visible meters loaded)
2. Add "Show neighbors" toggle on selected meter — draws lines/circle to neighbors within configurable radius
3. Add radius slider (50m–500m) for neighborhood visualization
4. Heatmap now uses server-computed grid (smoother, more accurate)

### Acceptance criteria
- [ ] Selecting a meter shows neighborhood overlay
- [ ] Radius slider updates visualization in real-time
- [ ] Heatmap visibly cleaner than before

---

## Phase 5.2 — Detail Drawer Spatial Section (2 hr)

### Tasks
1. New section in detail drawer: "Neighborhood Context"
   - Mini-map showing selected meter + neighbors
   - Stat: "X of Y neighbors also flagged"
   - Hint when high cluster risk: "⚠ This area shows clustered anomaly patterns"
2. Click neighbor in mini-map → switches drawer to that meter

### Acceptance criteria
- [ ] Spatial section renders for all meters
- [ ] Cluster warning appears for M15-M18 (they're neighbors)
- [ ] Click navigation works

---

## Phase 5.3 — Test & Buffer (2-3 hr)

- Full regression
- Visual QA: take screenshots showing new spatial features
- Commit: `feat(day5): spatial UI integration`

### If behind
**Cut:** the radius slider. Use a fixed default radius. Saves 30 min of frontend work.

---

# Day 6 — Kafka Setup & Producer

**Goal:** Kafka running locally; meter simulator producing real-time messages.

**Time budget:** 9-10 hours (high risk day — buffer aggressively)

## Phase 6.1 — Kafka Docker Setup (2 hr)

### Tasks
1. Add to `docker-compose.yml`:
   - `zookeeper` (or use Kafka KRaft mode to skip ZK — simpler)
   - `kafka` (image: `confluentinc/cp-kafka:latest`)
   - Configure single-broker setup with auto-create topics
2. Create topics:
   - `meter.readings` (partitions: 3, replication: 1)
   - `meter.alerts` (partitions: 1, replication: 1)
3. Add Kafka UI for debugging: `provectuslabs/kafka-ui`

### Acceptance criteria
- [ ] `docker compose up -d` brings up TimescaleDB + Kafka + UI
- [ ] Kafka UI accessible at `http://localhost:8080`
- [ ] Can produce/consume test messages from CLI

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T6.1.1 | `docker compose up -d` | All services healthy |
| T6.1.2 | Open Kafka UI | Lists topics |
| T6.1.3 | Produce test message via CLI | Visible in UI |
| T6.1.4 | Restart cluster | Topics persist |

**Common pitfalls** — note these now to save debugging time later:
- Wrong `KAFKA_ADVERTISED_LISTENERS` — connection works inside Docker but not from host
- Single-broker replication factor must be 1, not 3
- Auto-creation of topics not always reliable; create them explicitly via init script

---

## Phase 6.2 — Meter Simulator (Producer) (3 hr)

### Tasks
1. Create `backend/scripts/meter_simulator.py`:
   - Loads existing synthetic meter data
   - Replays it to Kafka in real-time (configurable speedup: 1x, 60x, 3600x)
   - Each message: `{meter_id, timestamp, kwh, feeder_id}`
   - Uses `aiokafka` (async, faster)
2. Configurable injection: simulator can inject anomalies live (replaces the existing `/api/simulate/theft` endpoint backend)
3. CLI flags: `--speed`, `--inject-theft`, `--reset`

### Acceptance criteria
- [ ] Simulator produces 20 meters × continuous stream
- [ ] Messages visible in Kafka UI
- [ ] Speed control works (60x = 1 day in 24 minutes)

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T6.2.1 | Run simulator at 1x | One message per meter per 15 min |
| T6.2.2 | Run simulator at 60x | Messages flow much faster |
| T6.2.3 | Inject theft via CLI | Anomaly visible in stream |
| T6.2.4 | Stop simulator | Clean shutdown, no errors |

---

## Phase 6.3 — Consumer + DB Sink (3 hr)

### Tasks
1. Create `backend/app/streaming/consumer.py`:
   - Async Kafka consumer reading `meter.readings`
   - Batches inserts to TimescaleDB (every 1 sec or 100 messages)
   - Uses consumer group for parallelism
2. Run consumer as a separate process: `python backend/scripts/run_consumer.py`
3. Add health endpoint: `/health/streaming` returns lag info

### Acceptance criteria
- [ ] Consumer reads from Kafka, writes to DB
- [ ] No message loss under normal load
- [ ] Lag visible and < 5 seconds during normal operation

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T6.3.1 | Producer + consumer running | DB row count grows |
| T6.3.2 | Stop consumer, restart | Resumes from last offset, no duplicates |
| T6.3.3 | Producer at 60x speed | Consumer keeps up, lag < 5s |
| T6.3.4 | Kill consumer mid-batch | DB state consistent (no half-written batches) |

---

## Phase 6.4 — End-of-Day Integration (1-2 hr)

- Run full streaming pipeline end-to-end
- Demo flow: simulator → Kafka → consumer → DB → API → frontend
- Commit: `feat(day6): kafka streaming ingestion`

### If behind
**This is the highest-risk day.** If by end of Day 6 you don't have producer+consumer working:
- **Cut:** the speed control feature, the live injection via simulator
- **Keep:** basic producer producing all data once, consumer writing to DB
- **Worst case fallback:** drop Kafka entirely. The pitch becomes "we built the streaming layer architecturally — Kafka producer/consumer modules exist as code and run locally — but for the live demo we use the existing batch ingestion." Be honest if it comes to this.

---

# Day 7 — Kafka Buffer + Half-Day Off

**Morning (4 hr):** Catch up on Kafka issues, performance tuning, edge cases.

**Afternoon: REST.** This is non-negotiable. Solo sprints fail because of fatigue more than scope. Take half the day off, sleep, do something unrelated.

### If on track from Day 6
- Add dead-letter queue handling
- Add monitoring metrics: messages/sec, lag, error rate
- Document Kafka setup in `docs/streaming.md`

### Day 7 Definition of Done
- [ ] Kafka pipeline reliable
- [ ] Caught up on any tech debt from Days 1-6
- [ ] You are rested

---

# Day 8 — Neighborhood Correlation Feature

**Goal:** Detect organized theft patterns where multiple nearby meters show coordinated anomalies.

**Time budget:** 8-9 hours

## Phase 8.1 — Algorithm Design (1 hr)

### Approach: Spatio-Temporal DBSCAN

Cluster anomaly events by space AND time:
- Two anomalies belong to the same cluster if:
  - They are within 200m of each other (configurable)
  - AND they occur within 6 hours of each other (configurable)
- A cluster of 3+ meters with anomalies = likely organized theft

### Tasks
1. Document algorithm in `docs/neighborhood_correlation.md`
2. Define output format: `{cluster_id, member_meters, time_window, confidence, theft_likelihood}`

---

## Phase 8.2 — Implementation (3.5 hr)

### Tasks
1. Create `backend/app/detection/neighborhood_correlator.py`:
   - Uses `scipy.spatial.distance` + custom temporal distance metric
   - Or `sklearn.cluster.DBSCAN` with custom metric function
   - Spatial component: PostGIS `ST_Distance` (already optimized)
   - Temporal component: timestamp difference
2. Run after individual anomaly detection completes
3. Output: list of clusters; each cluster boosts the composite score for its members

### Acceptance criteria
- [ ] M15-M18 detected as a single cluster on Day 6 of synthetic data
- [ ] M07 (isolated) doesn't form a cluster
- [ ] Cluster confidence increases with number of members
- [ ] Runs in < 2 seconds for 20-meter dataset

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T8.2.1 | Run on synthetic data | M15-M18 form cluster |
| T8.2.2 | M07 alone | No cluster (or single-member cluster ignored) |
| T8.2.3 | All 20 meters anomalous simultaneously | Detected as single grid-wide event (not theft cluster) |
| T8.2.4 | Vary radius parameter | More aggressive clustering at higher radius |
| T8.2.5 | Vary time window | Tighter time = fewer clusters |

---

## Phase 8.3 — API + Score Integration (2 hr)

### Tasks
1. New endpoint: `GET /api/clusters` — returns active anomaly clusters
2. Update `Alert` model: include `cluster_id` and `cluster_size` if part of cluster
3. Update composite score weighting:
   ```
   if member_of_cluster:
       composite_score *= (1 + 0.2 * (cluster_size - 1))  # capped at 2x boost
   ```
4. Update ranker to surface cluster members together

### Acceptance criteria
- [ ] M15-M18 alerts now have cluster_id
- [ ] Their composite scores are boosted appropriately
- [ ] `/api/clusters` returns cluster summary

---

## Phase 8.4 — UI for Clusters (2 hr)

### Tasks
1. Map: when cluster detected, draw a translucent polygon around cluster members (convex hull)
2. Polygon color matches cluster risk level (red for high)
3. Alert feed: clustered alerts grouped together, with a "Cluster of N" header
4. Detail drawer: "Part of Cluster" badge with link to other members

### Acceptance criteria
- [ ] Cluster polygon visible on map for M15-M18
- [ ] Clustered alerts visually grouped in feed
- [ ] Drawer shows cluster context

### If behind
**Cut:** the convex hull polygon (most complex). Just connect cluster members with lines instead.

---

# Day 9 — Neighborhood Correlation Polish + Buffer

**Time budget:** 7-8 hours

## Phase 9.1 — Edge Cases + Tuning (3 hr)

### Tasks
1. Handle edge case: cluster grows over time (members added as they become anomalous)
2. Handle edge case: cluster dissolves (members resolved)
3. Tune parameters via grid search on synthetic data:
   - Best radius: try 100m, 200m, 500m
   - Best time window: try 1hr, 6hr, 24hr
4. Document chosen defaults and rationale

---

## Phase 9.2 — Demo Story for Clustering (2 hr)

### Tasks
1. Update `docs/demo_script.md`:
   - New segment: live demo of clustering
   - "Watch as we inject coordinated theft on three adjacent meters — GridSense detects this as organized activity, not three separate events"
2. Make sure the simulate-theft modal allows selecting multiple adjacent meters
3. Practice this section of the demo specifically

---

## Phase 9.3 — Buffer Time (2-3 hr)

Catch up on anything from Days 1-8.

### Day 9 Definition of Done
- [ ] Clustering works reliably
- [ ] Demo story incorporates clustering
- [ ] All previous tests still pass

---

# Day 10 — Time-Pattern Analysis Feature

**Goal:** Per-feeder consumption baselines that learn over time, with deviation scoring on top.

**Time budget:** 8 hours

## Phase 10.1 — Baseline Learning Module (3 hr)

### Concept
For each feeder, learn:
- Hourly average consumption (24 buckets)
- Day-of-week multipliers (7 buckets)
- Festival/holiday multipliers (configurable list)
- Confidence intervals (mean ± 2σ)

### Tasks
1. Create `backend/app/detection/baseline_learner.py`
2. Train on first 3 days of data per feeder
3. Continuously update via online learning (each new day refines the baseline)
4. Output: expected kwh for any given (feeder, timestamp) tuple
5. Persist to DB: `feeder_baselines` table with hourly + dow patterns

### Acceptance criteria
- [ ] Baselines learn from data
- [ ] Predictions reasonable (within 10-15% of actual on normal days)
- [ ] Festival days configurable

### Test cases
| ID | Test | Expected |
|----|------|----------|
| T10.1.1 | Train on Days 1-3 | Baseline saved to DB |
| T10.1.2 | Predict for Day 4 8am | Within 15% of actual non-anomaly value |
| T10.1.3 | Predict for unknown timestamp | Falls back to weekly average |
| T10.1.4 | Update baseline with new day | Refines without overwriting completely |

---

## Phase 10.2 — Deviation Scoring (2 hr)

### Tasks
1. New score: `time_pattern_deviation_score`
   - Compare actual feeder reading vs baseline prediction
   - Z-score: how many standard deviations from expected
   - Score = sigmoid(z_score) for [0,1] range
2. Add as 4th component in composite score:
   ```
   composite = 0.25 * iso + 0.25 * lstm + 0.20 * gap + 0.15 * cluster_boost + 0.15 * time_pattern
   ```
3. Re-balance weights so total = 1.0

### Acceptance criteria
- [ ] Time-pattern deviation score computed for every meter at every timestep
- [ ] High scores correlate with known anomaly windows
- [ ] Composite score still ranks M07, M13, M15-M18 high

---

## Phase 10.3 — UI for Time Patterns (2 hr)

### Tasks
1. Add to detail drawer: "Time Pattern" section
   - Show baseline curve (24-hour expected consumption) alongside actual
   - Highlight hours where actual deviates from baseline
2. Add to top bar: "Festival mode" toggle (manually flag a date as festival, baseline adjusts)
3. Add explanation tooltip: "GridSense compares each meter against learned consumption patterns specific to its feeder, accounting for time-of-day and day-of-week."

---

## Phase 10.4 — Test & Commit (1 hr)

- Full regression
- Commit: `feat(day10): time-pattern analysis`

### If behind
**Cut:** the festival mode toggle. Festival multipliers can stay hardcoded for known Indian festival dates.

---

# Day 11 — Final Feature Integration & Buffer

**Goal:** All five excluded pieces are integrated. Today is for polish, edge cases, and catching anything that broke.

**Time budget:** 8 hours

## Tasks
1. Run full integration test from Day 1 to today
2. Verify all five features work together:
   - Kafka producer → consumer → TimescaleDB → detection (Iso + LSTM + Gap + Cluster + Time-Pattern) → PostGIS spatial queries → API → React UI
3. Profile end-to-end: where are bottlenecks?
4. Fix the 3-5 highest-impact issues

### Day 11 Definition of Done
- [ ] All five excluded features confirmed working
- [ ] Full demo flow runs end-to-end without intervention
- [ ] No critical bugs in main demo path
- [ ] Cumulative test suite green

---

# Day 12 — Full System Regression

**Goal:** Comprehensive test coverage. Find and fix everything before it's too late.

**Time budget:** 8-9 hours

## Phase 12.1 — Cumulative Test Sweep (3 hr)

Run **every test from every day** from the original prototype + Day 2.5 + Days 1-11 of this sprint.

### Master regression checklist

| Suite | Source | Status |
|-------|--------|--------|
| Original Day 1 (T1.x) | Prototype Day 1 | [ ] Pass |
| Original Day 2 (T2.x) | Prototype Day 2 | [ ] Pass |
| Original Day 3 (T3.x) | Prototype Day 3 | [ ] Pass |
| Original Day 4 (T4.x) | Prototype Day 4 | [ ] Pass |
| LSTM (T2.5.x) | Day 2.5 | [ ] Pass |
| Round 2 Day 1 (T1.x') | TimescaleDB setup | [ ] Pass |
| Round 2 Day 2 (T2.x') | DB migration | [ ] Pass |
| Round 2 Day 4 (T4.x') | PostGIS | [ ] Pass |
| Round 2 Day 6 (T6.x) | Kafka | [ ] Pass |
| Round 2 Day 8 (T8.x) | Neighborhood | [ ] Pass |
| Round 2 Day 10 (T10.x) | Time-Pattern | [ ] Pass |

---

## Phase 12.2 — Cross-Cutting Test Scenarios (3 hr)

| Scenario | Expected behavior |
|----------|-------------------|
| Cold start: clone repo, follow README, run docker compose, run all services | Demo works end-to-end in <15 min |
| Kafka down, consumer running | Consumer reconnects when Kafka restarts |
| TimescaleDB down | Backend logs errors, returns 503, no crash |
| Producer outpaces consumer (60x speed) | Consumer catches up; lag bounded |
| Restart entire stack | All state intact |
| Browser refresh during simulation | UI reconnects, state consistent |
| Two simultaneous theft injections | Both detected, no race conditions |
| 1-hour continuous run | No memory leaks, no degradation |

---

## Phase 12.3 — Bug Triage & Fix (2-3 hr)

Categorize all known issues:
- **Blockers** — break the demo: fix immediately
- **Major** — visible to judges: fix today
- **Minor** — cosmetic: list as known issues, fix only if time

### Day 12 Definition of Done
- [ ] All blockers fixed
- [ ] All majors fixed
- [ ] Minor issues documented in `KNOWN_ISSUES.md`
- [ ] Stack runs reliably for 1+ hour without intervention

---

# Day 13 — UI Polish + Documentation + Screenshots

**Goal:** Make the round 2 version look like a serious upgrade from the prototype.

**Time budget:** 7-8 hours

## Phase 13.1 — Visual Polish (2.5 hr)

### Tasks
1. Apply design system from `design_revamp_brief.md` to all NEW UI:
   - Cluster polygons use `--risk-critical` with 25% opacity fill
   - Time-pattern overlay charts use `--info` for baseline line
   - Streaming indicator (pulsing dot) in top bar showing live Kafka data flowing
2. New screenshots for README:
   - Dashboard with cluster polygon visible
   - Detail drawer showing time-pattern overlay
   - System architecture diagram (updated to show full stack)

---

## Phase 13.2 — Documentation Overhaul (3 hr)

### README sections to add/update
- **Architecture diagram** — now showing Kafka, TimescaleDB, PostGIS, all services
- **Tech Stack table** — fully populated, no "planned" entries
- **Detection Methodology** — covers all 5 signals (Iso Forest, LSTM, Gap, Cluster, Time-Pattern)
- **What's New in Round 2** section — explicit list of additions, with before/after table
- **How to Run** — updated for docker-compose multi-service stack
- **Performance Numbers** — actual measured latency, throughput, accuracy

### New docs
- `docs/architecture.md` — full system architecture, data flow diagrams
- `docs/round2_changelog.md` — what changed and why
- `docs/known_limitations.md` — honest list of what still doesn't scale

---

## Phase 13.3 — Ablation & Numbers (2 hr)

For the pitch, prepare a comparison table with real numbers:

| Capability | Prototype (Round 1) | Round 2 |
|-----------|---------------------|---------|
| Detection signals | Isolation Forest only* | Isolation Forest + LSTM + Gap + Cluster + Time-Pattern |
| Data ingestion | Batch CSV load | Kafka streaming, real-time |
| Storage | Pandas in-memory | TimescaleDB with continuous aggregates |
| Spatial queries | Lat/lng math | PostGIS, indexed |
| Organized theft detection | Manual inspection | Automatic clustering |
| Baseline learning | Static | Per-feeder, time-aware |
| Detection latency | After full pipeline run (~5s) | Streaming (~2s end-to-end) |
| Scale capability (estimated) | ~100 meters | ~10,000 meters |

*plus LSTM after Day 2.5

### Day 13 Definition of Done
- [ ] All new UI polished
- [ ] Documentation complete and honest
- [ ] Comparison table populated with measured numbers
- [ ] 5+ new screenshots available for video and README

---

# Day 14 — Final Video + Submission

**Goal:** New 5-minute video showcasing the upgraded system. Final submission.

**Time budget:** 7-8 hours

## Phase 14.1 — Demo Script v2 (1 hr)

### Updated 5-minute structure

| Time | Section | Talking points |
|------|---------|----------------|
| 0:00–0:30 | Recap problem + show prototype briefly | "Last round we proved the insight. This round we made it real." |
| 0:30–1:00 | What's new — quick visual tour of upgrades | Architecture diagram, mention all 5 additions |
| 1:00–2:30 | Live demo: streaming + clustering | Start meter simulator, show Kafka UI briefly, show data flowing into dashboard, inject coordinated theft on 3 adjacent meters, watch cluster form on map |
| 2:30–3:30 | Live demo: time-pattern + drilldown | Click clustered meter, show time-pattern overlay, show LSTM forecast vs actual |
| 3:30–4:30 | Performance + scale | Show comparison table, emphasize streaming latency and TimescaleDB throughput |
| 4:30–5:00 | Closing | "GridSense is no longer a prototype. It's a production-architecture system that catches theft as it happens." |

---

## Phase 14.2 — Recording (3 hr)

Following the same protocol as Day 5 of the original plan:
- Multiple takes
- Pick the best
- Edit cleanly
- Aim for 4:45–5:00 final length

---

## Phase 14.3 — Edit + Upload (2 hr)

- Edit, add intro/outro cards, normalize audio
- Upload to YouTube (unlisted)
- Update README with new video link
- Update `SUBMISSION.md` with all links

---

## Phase 14.4 — Final Submission (1 hr)

- Verify all 3 deliverables accessible
- Submit via official channel
- Tag release: `v1.0.0-round2`
- Send team-of-one a "shipped" message and rest

### Day 14 Definition of Done
- [ ] Video recorded, edited, uploaded
- [ ] All deliverables verified
- [ ] Submission confirmed
- [ ] Tagged release
- [ ] **You sleep for 12 hours**

---

## Final Sign-Off Block

```
GridSense Round 2 — Sprint Complete
====================================
Date completed:     ____________________
Total dev days:     ____ / 14
Phases cut:         ____________________
Phases extended:    ____________________

Deliverables:
  Working prototype:  [ ] Submitted
  5-min video:        [ ] Submitted
  Code repository:    [ ] Submitted

All 5 excluded features integrated:
  Kafka:              [ ] ✓
  TimescaleDB:        [ ] ✓
  PostGIS:            [ ] ✓
  Neighborhood Corr:  [ ] ✓
  Time-Pattern:       [ ] ✓

Lessons learned:
______________________________________
______________________________________
______________________________________
```

---

## Closing Thought

This sprint is genuinely ambitious for solo work. The plan accounts for that with explicit cut points at every phase. **Honoring those cut points is the difference between shipping and burning out.**

If by Day 7 you're significantly behind, drop Kafka and refactor the pitch around "production-grade time-series + spatial intelligence + advanced detection ensemble" — that's still a strong story, and it's better than a broken Kafka demo.

Ship something working. Ship it on time. Sleep enough to think clearly.
