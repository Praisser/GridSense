# GridSense — AI-Powered Loss Intelligence Platform

GridSense is a specialized analytics engine designed to detect and classify non-technical losses (NTL) in electricity distribution networks. By shifting focus from individual meters to the **feeder-meter gap**, GridSense identifies theft and anomalies that traditional systems miss.

![GridSense dashboard](docs/dashboard.png)

## The Problem
India loses over ₹26,000 crore annually to electricity theft and non-technical losses. Traditional Advanced Metering Infrastructure (AMI) often fails to detect sophisticated theft because a tampered meter simply looks like a low-consumption customer. Most anomalies go undetected for months until manual field audits are conducted.

## The Insight: "Watch the Gap"
Theft doesn't make energy disappear; it just makes it invisible to the billing meter. GridSense monitors the **real-time gap** between the energy supplied by a feeder and the energy recorded by all downstream meters. When consumption drops but the gap increases, GridSense fingerprints the signature of theft.

## How It Works

![GridSense architecture](docs/architecture.png)

```mermaid
graph TD
    A[Smart Meters] -->|Consumption Data| B(Gap Detector)
    F[Feeder Meter] -->|Supply Data| B
    B -->|Anomaly Signals| C{AI Classifier}
    C -->|Bypass| D[Ranked Alerts]
    C -->|Tampering| D
    C -->|Faulty| D
    D --> E[Field Inspection App]
```

1.  **Gap Detection Engine**: Real-time comparison between feeder input and aggregated meter readings.
2.  **Loss Fingerprinting**: Heuristic and ML models classify anomalies into `Bypass`, `Tampering`, or `Faulty`.
3.  **Neighborhood Correlation**: Detects coordinated tampering events across nearby meters.
4.  **Risk Ranking**: Prioritizes alerts based on total energy lost and detection confidence.

## Demo

The live walkthrough path is documented in [docs/demo_script.md](docs/demo_script.md). Start the backend and frontend, open the dashboard, then use the amber **Simulate** control to inject theft on `M03`; the alert feed and map update without a manual refresh.

Demo video link: _to be added after recording_.

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React, Vite, Tailwind CSS, Recharts, Leaflet |
| **Backend** | Python, FastAPI, Scikit-learn, Pandas |
| **Data** | Synthetic Meter Data Generator (15-min intervals) |
| **DevOps** | GitHub Actions (CI), Pytest |

## Quick Start

### 1. Prerequisite: Python 3.9+ & Node.js 18+

### 2. Setup Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
export DATABASE_URL="postgresql://gridsense:gridsense@localhost:55432/gridsense"
python -m uvicorn app.main:app --reload --port 8000
```

> **Note:** The `DATABASE_URL` export is required at runtime. Copy `backend/.env.example` to `backend/.env` to persist it.
> The app works from the bundled CSV data without Docker; Docker only enables TimescaleDB features.

### 3. Setup Frontend
> Open a **new terminal window** (the backend server must stay running in the first one).
> Navigate back to the repo root, then:

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Run Tests
> Run all commands from the repo root.

```bash
# Backend tests
pytest backend/tests

# Frontend tests + build verification
cd frontend && npm test && npm run build && cd ..
```

## Project Structure
```text
GridSense/
├── backend/            # FastAPI Application
│   ├── app/            # Core Logic
│   │   ├── detection/  # ML Models & Heuristics
│   │   └── main.py     # API Endpoints
│   └── tests/          # Pytest Suite
├── frontend/           # React Dashboard
│   ├── src/            # Components & Hooks
│   └── tailwind.config # Visual Styling
├── data/               # Simulation Data & Generator
└── docs/               # Architecture & Screenshots
```

## Detection Methodology
GridSense uses an **Isolation Forest** ensemble to score meter-level deviations against a 3-day baseline. These scores are then correlated with the **Feeder Gap Ratio**. A high anomaly score concurrent with a widening gap triggers a `bypass_theft` alert. Coordinated drops across a geographic cluster trigger `meter_tampering` alerts.

## Roadmap to Production
- **Real-time Stream**: Integration with Kafka for sub-second processing.
- **Geospatial Intelligence**: PostGIS for advanced neighborhood loss heatmaps.
- **Predictive Maintenance**: Forecasting transformer failure due to overload from theft.

## Team
- GridSense Prototype Team — product, detection logic, backend API, and React dashboard.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, test commands, and contribution guidelines.

## License
MIT
