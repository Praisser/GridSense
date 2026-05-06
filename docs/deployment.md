# GridSense Deployment Notes

## Live Infrastructure

| Component | Provider | URL |
|-----------|----------|-----|
| React frontend | GitHub Pages | https://praisser.github.io/GridSense/ |
| FastAPI backend | Render Web Service (free) | https://gridsense-backend.onrender.com |
| TimescaleDB | Render Postgres (free) | Internal to Render network |

## Cold Start Warning

The Render free tier sleeps after 15 minutes of inactivity. The first request
after sleep takes **~30 seconds**. Always hit `/health` once before a demo or
video recording and wait for the response before proceeding.

Workaround: [UptimeRobot](https://uptimerobot.com) free tier can ping
`https://gridsense-backend.onrender.com/health` every 5 minutes to keep the
backend warm at no cost.

## What Is NOT Live

| Feature | Status | Reason |
|---------|--------|--------|
| Kafka streaming | Local only | Requires persistent broker; not in scope for free-tier deploy |
| Persistent simulation state | Resets on restart | In-memory dict; redeploying Render wipes state |
| TimescaleDB hypertables | Depends on Render Postgres version | If extension unavailable, plain Postgres used (identical demo behavior) |

## Deployment Architecture

```
Browser → GitHub Pages (static React build)
              ↓ VITE_API_BASE
        Render Web Service (FastAPI)
              ↓ DATABASE_URL (internal)
        Render Postgres (TimescaleDB or plain Postgres)
```

## Redeployment

Frontend auto-deploys on push to `main` or `deploy/render-pages` via
`.github/workflows/deploy.yml`.

Backend redeploys automatically when Render detects a new commit on the
connected branch (`deploy/render-pages`).

## Environment Variables (Render Web Service)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Internal Render Postgres URL (from DB "Connect" tab) |
| `PYTHON_VERSION` | `3.11.0` |

## Local Development

See [README.md Quick Start](../README.md#quick-start). Local runs use
`http://localhost:8000` and `http://localhost:5173` — no changes needed.
