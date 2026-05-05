# GridSense — Known Issues

## Open Issues

### KI-001 · Forecast model is pattern-based, not LSTM
**Severity:** Minor  
**Status:** By design for prototype  
`GET /api/meters/{id}/forecast` uses a 7-day rolling daily-average pattern rather than a trained LSTM model.
The endpoint contract and chart are correct; the model quality is intentionally simplified for the prototype.
A real LSTM would be trained offline on historical meter data in a production deployment.

### KI-002 · Alert statuses are in-memory only
**Severity:** Minor  
**Status:** By design for prototype  
`/api/alerts/{id}/inspect|dismiss|resolve` store status in a Python dict (`_alert_statuses`).
Restarting the backend resets all statuses. In production, these would be persisted to the `alerts` table in TimescaleDB.

### KI-003 · No authentication or authorization
**Severity:** Minor (prototype)  
**Status:** Intentional — documented  
All API endpoints are currently public. Production deployment requires BESCOM SSO integration and RBAC
for field officers vs. supervisors. See `docs/database_schema.md` for the planned user/role model.

### KI-004 · Map tiles require internet
**Severity:** Minor  
**Status:** Open  
The FeederMap component uses OpenStreetMap tiles via Leaflet. If the demo machine is offline, the map
background will be blank (markers still render). Workaround: pre-cache tiles or switch to a local
tile server.

### KI-005 · `wip` commit in history
**Severity:** Cosmetic  
**Status:** Known  
Commit `44c6e54` has a `wip:` prefix from a mid-session checkpoint. It is not the tip of any branch
and does not affect functionality. The `ui-fixes` branch commits above it all follow conventional format.

---

_Last updated: 2026-05-05_
