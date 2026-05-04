# GridSense — Forward-Fix Runbook

> **Mission:** Diagnose why the demo is broken after the agent's TimescaleDB integration, then fix it. Total time budget: **90 minutes hard cap.**
>
> **If we're not at "demo works" by the 90-minute mark, we roll back. No exceptions.**

---

## Pre-flight: Preserve the agent's work

Before touching anything, save the current state in a branch so we can come back to it:

```bash
git status
git add -A
git commit -m "wip: round 2 day 1 in progress, demo broken"
git branch round2-attempt-saved
git push origin round2-attempt-saved
```

If `git status` shows uncommitted changes that you don't want to commit, stash them instead:
```bash
git stash push -m "round 2 day 1 wip"
```

**Confirm before continuing:** You have a way to recover this work if the fix-forward attempt fails.

- [ ] Branch `round2-attempt-saved` exists (run `git branch | grep round2-attempt-saved`)

---

## Phase 1 — Diagnosis (15 minutes)

Run each command, copy the output, paste into your reply to me. **Don't try to fix anything yet.** We need the full picture first.

### 1.1 — Is Docker running?

```bash
docker compose ps
```

**What I'm looking for:**
- Container name (something like `gridsense-db` or `timescaledb`)
- Status: should say `running` or `healthy`
- Ports: should show `0.0.0.0:55432->5432/tcp`

**Capture the full output.**

---

### 1.2 — Is the database actually accepting connections?

```bash
docker exec -it $(docker compose ps -q | head -1) psql -U gridsense -d gridsense -c "SELECT COUNT(*) FROM meter_readings;"
```

If this returns `13440`, the DB is healthy.
If it returns an error, **copy the error verbatim.**

---

### 1.3 — Does the backend start?

In a fresh terminal:

```bash
cd backend
source venv/bin/activate
export DATABASE_URL="postgresql://gridsense:gridsense@localhost:55432/gridsense"
uvicorn app.main:app --reload --port 8000 2>&1 | tee /tmp/backend.log
```

Wait 10 seconds, then tell me:
- **Did it start?** (you'd see `Uvicorn running on http://127.0.0.1:8000`)
- **Are there warnings or errors above that line?**
- **If it crashed, copy the last 30 lines of `/tmp/backend.log`**

Leave this terminal running. We'll use it.

---

### 1.4 — Are endpoints responding?

In a second terminal:

```bash
echo "=== /health ==="
curl -s -w "\nHTTP %{http_code}\n" http://localhost:8000/health
echo ""
echo "=== /api/alerts ==="
curl -s -w "\nHTTP %{http_code}\n" http://localhost:8000/api/alerts | head -100
echo ""
echo "=== /api/feeder/F001/readings ==="
curl -s -w "\nHTTP %{http_code}\n" "http://localhost:8000/api/feeder/F001/readings" | head -50
```

**Copy all output.** I need to see HTTP codes and the first chunk of each response.

---

### 1.5 — Does the frontend run and connect?

In a third terminal:

```bash
cd frontend
npm run dev
```

Then in your browser:
1. Open `http://localhost:5173`
2. Press F12 to open dev tools
3. Click the **Console** tab — copy any red errors
4. Click the **Network** tab — refresh the page, look at calls to `localhost:8000`. Are they green (2xx) or red (4xx/5xx)?

**Tell me:**
- Does the dashboard render at all?
- Any red console errors? (paste the first 3)
- Any red network calls? (which endpoints, what status codes?)

---

## Phase 2 — Report Back

**Stop here.** Paste me everything from Phase 1 in one message. Use this template:

```
=== 1.1 docker compose ps ===
[paste]

=== 1.2 db query ===
[paste]

=== 1.3 backend startup ===
Started successfully? Yes / No
Last lines of log:
[paste]

=== 1.4 endpoints ===
/health: HTTP [code], body: [paste]
/api/alerts: HTTP [code], body: [paste first chunk]
/api/feeder/F001/readings: HTTP [code], body: [paste first chunk]

=== 1.5 frontend ===
Dashboard renders? Yes / No / Partially
Console errors: [paste first 3 or "none"]
Network failures: [paste or "none"]
```

I'll diagnose and tell you the exact fix.

---

## Phase 3 — Likely Fixes (Reference Only — Don't Run Until I Confirm)

These are the most likely root causes. **Wait for me to tell you which one applies before running any of these.** Running the wrong fix wastes time.

### Fix A — Backend doesn't read DATABASE_URL from anywhere

**Symptom:** Backend crashes immediately with "DATABASE_URL not set" or similar.

**Fix:** Create `backend/.env`:
```bash
cd backend
cat > .env <<EOF
DATABASE_URL=postgresql://gridsense:gridsense@localhost:55432/gridsense
EOF
```

Then ensure something in `app/main.py` or `app/db/connection.py` loads it:
```bash
pip install python-dotenv
```

And add to the top of `app/main.py`:
```python
from dotenv import load_dotenv
load_dotenv()
```

Restart backend. Re-run Phase 1.

---

### Fix B — Backend starts but `/health` returns 503 because DB check fails

**Symptom:** `/health` returns 503 or 500. `/api/alerts` may still work if it uses CSV.

**Fix:** Make the DB health check non-blocking. Find the `/health` endpoint in `app/main.py` (or wherever it's defined). It probably looks like:

```python
@app.get("/health")
async def health():
    # checks DB connection and fails the whole endpoint if DB is down
    ...
```

Change it to be tolerant:

```python
@app.get("/health")
async def health():
    db_ok = False
    try:
        # whatever DB ping logic is there
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok", "database": "connected" if db_ok else "disconnected"}
```

Restart backend. Re-run Phase 1.4.

---

### Fix C — Backend starts but endpoints use partially-migrated DB code that fails

**Symptom:** `/health` works. `/api/alerts` returns 500. Backend log shows `relation "meter_readings" does not exist` or `connection to server failed`.

**Fix:** The agent may have started migrating endpoints. Find the endpoint code that's failing and revert it to use the CSV-based path. Most likely location: `app/main.py` or `app/api/alerts.py`.

Check what's in `app/db/` that the endpoints might be importing:
```bash
ls backend/app/db/
grep -r "from app.db" backend/app/ | grep -v __pycache__
```

If endpoints import from `app.db`, but the migration to use it isn't complete, find each import and switch back to the original pandas-based code.

**However:** if the agent really only did Day 1 (database foundation, no endpoint migration), this fix shouldn't be needed. The endpoints should still work on the original code path.

---

### Fix D — Port 5432 vs 55432 confusion

**Symptom:** Backend logs show "could not connect to server: Connection refused" on port 5432.

**Fix:** Something is hardcoded to 5432. Search for it:

```bash
grep -rn "5432" backend/app/ backend/scripts/ | grep -v 55432 | grep -v __pycache__
```

For each match, change `5432` to `55432`, OR better — make it use the `DATABASE_URL` env var instead of hardcoded values.

---

### Fix E — Frontend can't reach backend (CORS)

**Symptom:** Frontend dev tools show CORS error like "blocked by CORS policy" on `localhost:8000`.

**Fix:** Confirm CORS middleware in `app/main.py` includes `http://localhost:5173`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Restart backend.

---

### Fix F — Backend imports new DB module that has a bug

**Symptom:** Backend crashes on import with `ImportError`, `ModuleNotFoundError`, or syntax error in something under `app/db/`.

**Fix:** Find the broken import. Most likely:
```bash
python -c "from app.db.connection import get_db" 2>&1
```

Whatever error this prints points to the file to fix or remove from imports.

If the new DB module is broken AND nothing critical depends on it yet, just stop importing it from `main.py`:
```bash
grep -n "from app.db" backend/app/main.py
```
Comment out the offending import line. Demo will work without database.

---

## Phase 4 — Verify Demo Works (10 minutes)

Once we apply a fix and the backend starts and responds, walk through the demo:

1. **Backend running:** `uvicorn app.main:app --reload --port 8000`
2. **Frontend running:** `npm run dev`
3. **Open dashboard:** `http://localhost:5173`
4. **Verify each piece:**
   - [ ] Top bar shows
   - [ ] Alert feed populates (M07, M13, M15-M18 visible)
   - [ ] Map renders with all 20 meter markers
   - [ ] Click a meter → drawer opens with details
   - [ ] Gap timeline chart renders
   - [ ] LSTM forecast chart works in drawer
   - [ ] Simulate Theft button works
   - [ ] No red errors in browser console

If any of these fail, **stop and report back** — don't keep poking.

---

## Phase 5 — Lock It Down (10 minutes)

Once everything works:

```bash
git status
git add -A
git commit -m "fix: restore demo functionality after round 2 day 1 integration"
git tag v0.2.1-prototype-demo-working
git push origin main --tags
```

Now write a 1-line note to yourself: **the database layer is present but the demo runs on the original code path.** Document this in the README or a `KNOWN_STATE.md` file so you remember what's actually live for the demo.

---

## Phase 6 — If Something Goes Wrong (Decision Tree)

### After Phase 1 diagnosis, if I tell you the fix and...

**...the fix works → ** Great. Continue to Phase 4.

**...the fix doesn't work → ** Tell me. We try one more thing. **Maximum two iterations.**

**...we hit the 90-minute mark and demo still doesn't work →**
Execute the rollback immediately. No more fixing.

```bash
git log --oneline -20  # find last good commit (probably v0.2.0-prototype-revamped)
git checkout main
git reset --hard <good-commit-hash>
git push --force-with-lease origin main
docker compose down
```

The TimescaleDB work is preserved on `round2-attempt-saved`. Round 2 starts there if you're selected.

---

## Phase 7 — After Demo Is Working (the next 2-3 days)

This is the original prototype submission timeline. Everything in this section is unchanged from the Day 5 plan.

### Day-of-fix (today, after demo works)
- Take fresh screenshots of the working dashboard for the README
- Run the demo flow end-to-end 3 times to confirm reliability
- Commit any small polish

### Next day — Demo recording
- Set up OBS or Loom
- Record 5-minute walkthrough following the demo script
- Multiple takes, pick the best
- Edit (cut filler, add intro/outro cards)
- Upload to YouTube unlisted

### Final day — Submission
- Update README with video link
- Verify all 3 deliverables accessible
- Submit via official channel
- Tag `v1.0.0-prototype-submission`
- Sleep

---

## What to send me after Phase 1

Just paste the diagnosis output following the template in Phase 2. Don't apply any fixes yet. Once I see the actual failure mode, I'll point you at the right fix in Phase 3 and we can move fast from there.

**Reminder: 90-minute timer. If you started it before Phase 1, how much time is left?**
