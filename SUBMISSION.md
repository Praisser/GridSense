# GridSense — Submission

## Deliverable Links

- **Live Web App:** https://praisser.github.io/GridSense/
- **Demo Video (5 min):** _to be added after recording_
- **Code Repository:** https://github.com/Praisser/GridSense

## Quick Start (run locally)

See [README.md](./README.md#quick-start).

## Architecture

- Frontend: React + Vite on GitHub Pages
- Backend: FastAPI on Render (free tier — ~30s cold start after idle)
- Database: TimescaleDB on Render Postgres

## Known Limitations

See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

- In-memory alert statuses reset on backend restart (free tier)
- Forecast uses pattern-based projection, not a trained LSTM
- Map tiles require internet connection

## Release Tag

`v1.0.0-prototype-audit-passed`
