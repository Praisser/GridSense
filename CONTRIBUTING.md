# Contributing to GridSense

GridSense is a hackathon prototype, so contributions should keep the demo path stable and easy to run.

## Local Setup

Run the backend from `backend/`:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Run the frontend from `frontend/`:

```bash
npm install
npm run dev
```

## Before Opening a PR

Run the backend tests:

```bash
pytest backend/tests
```

Run the frontend checks:

```bash
cd frontend
npm test
npm run build
```

## Guidelines

- Keep simulation behavior repeatable; reset the simulation before recording demos.
- Add or update tests for backend detection behavior and frontend data helpers.
- Do not commit local `.env` files or generated secrets.
- Keep UI changes consistent with the existing dashboard density and control style.
