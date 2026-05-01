# Day 1 — Scaffolding & Mock Data Pipeline

**Goal:** End the day with a runnable repo containing a synthetic feeder dataset, a FastAPI backend that serves data, and a React frontend shell that can fetch from it.

**Time budget:** ~8 hours

---

## Phase 1.1 — Repository Setup (45 min)

### Tasks
1. Create GitHub repo `gridsense` (public, MIT license)
2. Set up folder structure:
   ```
   gridsense/
   ├── backend/
   │   ├── app/
   │   │   ├── __init__.py
   │   │   ├── main.py
   │   │   ├── models.py
   │   │   ├── data_loader.py
   │   │   └── detection.py
   │   ├── requirements.txt
   │   └── tests/
   ├── frontend/
   │   ├── src/
   │   ├── package.json
   │   └── vite.config.js
   ├── data/
   │   ├── generator.py
   │   ├── feeder_input.csv
   │   └── meters.csv
   ├── docs/
   │   └── architecture.png
   ├── .gitignore
   ├── README.md
   └── LICENSE
   ```
3. Add `.gitignore` for Python (`__pycache__`, `venv`, `.env`) and Node (`node_modules`, `dist`)
4. Initial README with one-liner: "GridSense — AI-powered electricity loss intelligence platform"
5. First commit: `chore: initial scaffolding`

### Acceptance criteria
- [ ] Repo is cloneable via `git clone`
- [ ] Folder structure matches above
- [ ] README renders correctly on GitHub
- [ ] `.gitignore` works (no `__pycache__` or `node_modules` in commits)

---

## Phase 1.2 — Synthetic Data Generator (2 hours)

### Goal
Generate a realistic dataset simulating BESCOM smart meter feeds, with deliberately injected theft events for the demo.

### Specs
- **1 feeder** supplying 20 meters
- **7 days** of readings at **15-minute intervals** (672 readings per meter)
- **Geographic clustering**: 20 meters spread across a 500m × 500m area with realistic lat/lng around Bengaluru (12.9716°N, 77.5946°E)
- **Consumption baselines**: Each meter has a per-household profile (low/medium/high usage)
- **Time patterns**: Higher consumption 6-10 AM and 6-11 PM, low overnight
- **Injected anomalies**:
  - Meter `M07` — bypass theft starting Day 4 (consumption drops 60%, but feeder gap appears)
  - Meter `M13` — meter tampering Day 5 onwards (flat-line readings at suspiciously low value)
  - Meters `M15-M18` — neighborhood organized theft Day 6 (clustered drop in readings)

### Tasks
1. Write `data/generator.py`:
   - Use `pandas`, `numpy`, `datetime`
   - Generate base consumption with sine waves for daily/weekly patterns + Gaussian noise
   - Inject the 3 theft scenarios
   - Compute feeder input as `sum(all meters) + 4-7% technical losses`
   - For theft windows, feeder input remains true total (the gap reveals theft)
2. Output two CSV files:
   - `feeder_input.csv` (timestamp, feeder_id, kwh)
   - `meters.csv` (timestamp, meter_id, kwh, lat, lng)
3. Add `data/README.md` documenting injected events and timestamps

### Acceptance criteria
- [ ] `python data/generator.py` runs without errors
- [ ] Output CSVs have correct row counts (672 for feeder, 13,440 for meters)
- [ ] Meter readings show realistic daily peaks
- [ ] Sum of all meter readings ≈ feeder input on normal days (within 7%)
- [ ] On theft days, gap exceeds 10% (sanity check the injection works)

### Test cases — Phase 1.2

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T1.2.1 | Unit | Run generator with seed=42 twice | Outputs are byte-identical |
| T1.2.2 | Unit | Verify row count of `meters.csv` | 20 × 672 = 13,440 rows |
| T1.2.3 | Data validity | Check no negative kwh values | All values ≥ 0 |
| T1.2.4 | Data validity | Check timestamps are 15 min apart | All deltas = 900 seconds |
| T1.2.5 | Anomaly injection | M07 readings on Day 4 | Avg 60% lower than Day 1-3 baseline |
| T1.2.6 | Anomaly injection | M13 readings on Day 5+ | Standard deviation < 0.1 (flat-line check) |
| T1.2.7 | Gap consistency | Day 1 feeder vs sum(meters) | Within 4-7% (technical loss only) |
| T1.2.8 | Gap consistency | Day 4 feeder vs sum(meters) | Gap > 10% (theft detectable) |

---

## Phase 1.3 — FastAPI Backend Scaffold (2 hours)

### Tasks
1. Create Python virtualenv: `python -m venv venv && source venv/bin/activate`
2. Install: `fastapi uvicorn pandas numpy scikit-learn pydantic python-multipart`
3. Pin in `backend/requirements.txt`
4. Build `app/main.py`:
   - CORS middleware enabled (allow `http://localhost:5173` for Vite)
   - Health endpoint: `GET /health` → `{"status": "ok"}`
   - Data endpoint: `GET /api/feeder/{feeder_id}/readings?start=&end=`
   - Stub endpoint: `GET /api/alerts` → returns empty list for now
5. Build `app/data_loader.py`:
   - Load `meters.csv` and `feeder_input.csv` into pandas DataFrames at startup
   - Cache in memory
6. Add Pydantic models in `app/models.py` for `Reading`, `Alert`, `Meter`
7. Run server: `uvicorn app.main:app --reload --port 8000`

### Acceptance criteria
- [ ] `GET http://localhost:8000/health` returns 200 OK
- [ ] `GET /api/feeder/F001/readings` returns JSON array of readings
- [ ] OpenAPI docs visible at `/docs`
- [ ] CORS headers present in responses

### Test cases — Phase 1.3

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T1.3.1 | Smoke | `curl localhost:8000/health` | 200 with `{"status":"ok"}` |
| T1.3.2 | Integration | GET `/api/feeder/F001/readings` | 200 with array of 672 readings |
| T1.3.3 | Integration | GET `/api/feeder/INVALID/readings` | 404 with error message |
| T1.3.4 | Integration | GET `/api/feeder/F001/readings?start=2024-01-02&end=2024-01-03` | Filtered subset (96 rows for one day) |
| T1.3.5 | Integration | GET `/api/alerts` | 200 with empty array `[]` |
| T1.3.6 | CORS | OPTIONS request from `http://localhost:5173` | `Access-Control-Allow-Origin` present |
| T1.3.7 | Error handling | GET malformed date param | 422 validation error |
| T1.3.8 | Performance | GET full week readings | Response < 500ms |

---

## Phase 1.4 — React Frontend Scaffold (1.5 hours)

### Tasks
1. `cd frontend && npm create vite@latest . -- --template react`
2. Install dependencies: `npm install axios recharts leaflet react-leaflet lucide-react`
3. Install dev dependencies: `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`
4. Configure Tailwind in `tailwind.config.js` with content paths
5. Build `src/App.jsx` with three-panel layout shell:
   - Left sidebar: alert list placeholder
   - Center: map placeholder
   - Right: detail drawer placeholder
6. Build `src/api/client.js` — axios instance with `baseURL: 'http://localhost:8000'`
7. Health check on mount: fetch `/health`, show banner "Connected to backend ✓" or red "Backend offline"
8. Run: `npm run dev` (Vite default port 5173)

### Acceptance criteria
- [ ] `npm run dev` starts without errors
- [ ] Page loads at `http://localhost:5173`
- [ ] Three-panel layout visible
- [ ] Health status indicator shows "Connected" when backend is running
- [ ] Console has no React errors

### Test cases — Phase 1.4

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T1.4.1 | Smoke | Run `npm run dev` | Server starts on port 5173 |
| T1.4.2 | Smoke | Open browser to localhost:5173 | Layout renders without errors |
| T1.4.3 | Integration | Backend running, refresh page | Health banner shows "Connected" |
| T1.4.4 | Integration | Backend stopped, refresh page | Health banner shows "Offline" |
| T1.4.5 | Build | Run `npm run build` | Builds without warnings, dist/ generated |
| T1.4.6 | Console | Open dev tools | Zero React errors or warnings |

---

## Phase 1.5 — End-of-Day Integration Smoke Test (30 min)

### Full system check
1. Start backend: `uvicorn app.main:app --reload`
2. Start frontend: `npm run dev`
3. Open `http://localhost:5173`
4. Verify:
   - Frontend loads
   - Health banner shows "Connected"
   - Network tab shows successful CORS calls to `/health`
5. Hit `/api/feeder/F001/readings` directly in browser; confirm JSON output
6. Commit and push: `feat(day1): scaffolding, data generator, backend + frontend shell`

### Day 1 regression checklist

| ID | Check | Pass criteria |
|----|-------|---------------|
| R1.1 | Repo clones cleanly on a fresh machine | `git clone` succeeds, structure intact |
| R1.2 | Backend starts from scratch | `pip install -r requirements.txt && uvicorn app.main:app` works |
| R1.3 | Frontend starts from scratch | `npm install && npm run dev` works |
| R1.4 | Data generator is reproducible | Same seed → identical output |
| R1.5 | API responds to all 4 endpoints | health, readings, readings with filter, alerts |
| R1.6 | No secrets in repo | No API keys, .env files, or credentials committed |

---

## Day 1 Definition of Done

- [ ] All Phase 1.1-1.5 acceptance criteria met
- [ ] All test cases pass
- [ ] Code pushed to `main` branch
- [ ] README updated with "How to run locally" section
- [ ] One screenshot of the running shell added to `docs/`

## Hand-off to Day 2

Day 2 starts with the synthetic dataset and an empty `/api/alerts` endpoint. Day 2 fills in the AI detection layer that powers that endpoint.
