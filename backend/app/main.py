from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List, Optional
import pandas as pd

from .models import Reading, Alert, Meter, SimulationRequest
from .data_loader import data_loader
from .detection.gap_detector import compute_gaps
from .detection.meter_scorer import score_all_meters
from .detection.loss_classifier import classify_loss_type, detect_cluster_tampering
from .detection.ranker import rank_meters
from .db.connection import check_database_connection

_cached_alerts: List[Alert] = []
_cached_data_signature = None
_models_dir = Path(__file__).resolve().parents[1] / "models"
_simulation_window_readings = 48
_simulation_baseline_meters_df: Optional[pd.DataFrame] = None
_active_simulations: Dict[str, SimulationRequest] = {}
_simulation_events: List[Dict[str, Any]] = []
_alert_statuses: Dict[str, str] = {}  # meter_id -> "open"|"inspecting"|"dismissed"|"resolved"

logger = logging.getLogger("gridsense.simulation")

_SIMULATION_LOSS_TYPES = {
    "bypass": "bypass_theft",
    "tampering": "meter_tampering",
    "faulty": "faulty_meter",
}


def _data_signature(feeder_df: pd.DataFrame, meters_df: pd.DataFrame):
    if feeder_df is None or meters_df is None:
        return None

    feeder_hash = (
        int(pd.util.hash_pandas_object(feeder_df, index=True).sum())
        if not feeder_df.empty
        else 0
    )
    meters_hash = (
        int(pd.util.hash_pandas_object(meters_df, index=True).sum())
        if not meters_df.empty
        else 0
    )
    return (len(feeder_df), feeder_hash, len(meters_df), meters_hash)


def _record_simulation_event(action: str, **details):
    event = {
        "id": len(_simulation_events) + 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        **details,
    }
    _simulation_events.append(event)
    logger.info("Simulation event recorded: %s", event)
    return event


def _set_simulation_baseline_from_current():
    global _simulation_baseline_meters_df
    if data_loader.meters_df is None or data_loader.meters_df.empty:
        _simulation_baseline_meters_df = None
        return

    _simulation_baseline_meters_df = data_loader.meters_df.copy(deep=True)


def _ensure_simulation_baseline():
    if _simulation_baseline_meters_df is None:
        _set_simulation_baseline_from_current()


def _apply_active_simulations_to_data():
    _ensure_simulation_baseline()
    if _simulation_baseline_meters_df is None:
        return

    simulated_df = _simulation_baseline_meters_df.copy(deep=True)
    for req in _active_simulations.values():
        mask = simulated_df["meter_id"] == req.meter_id
        indices = simulated_df[mask].index[-_simulation_window_readings:]

        if req.type == "faulty":
            simulated_df.loc[indices, "kwh"] = 0.0
            continue

        factor = max(0.05, 1.0 - req.intensity)
        simulated_df.loc[indices, "kwh"] = (
            pd.to_numeric(simulated_df.loc[indices, "kwh"], errors="coerce").fillna(0.0)
            * factor
        )

    data_loader.meters_df = simulated_df


def _simulation_classification(req: SimulationRequest):
    confidence_floor = {
        "bypass": 0.72,
        "tampering": 0.68,
        "faulty": 0.82,
    }[req.type]
    confidence = min(0.95, max(confidence_floor, 0.52 + req.intensity * 0.45))

    reasoning = {
        "bypass": (
            f"Live simulation injected a {req.intensity * 100:.0f}% bypass drop "
            "over the latest readings, creating a feeder-meter gap."
        ),
        "tampering": (
            f"Live simulation injected a {req.intensity * 100:.0f}% tampering "
            "signature while preserving the meter's daily rhythm."
        ),
        "faulty": (
            "Live simulation flat-lined the latest meter readings, matching a "
            "faulty meter signature."
        ),
    }[req.type]

    return {
        "type": _SIMULATION_LOSS_TYPES[req.type],
        "confidence": float(confidence),
        "reasoning": reasoning,
    }


def _apply_simulation_classification_overrides(classifications):
    for meter_id, req in _active_simulations.items():
        classifications[meter_id] = _simulation_classification(req)


def run_detection_pipeline(force: bool = False):
    global _cached_alerts, _cached_data_signature
    feeder_df = data_loader.feeder_df
    meters_df = data_loader.meters_df

    if feeder_df is None or feeder_df.empty or meters_df is None or meters_df.empty:
        _cached_alerts = []
        _cached_data_signature = None
        return

    signature = _data_signature(feeder_df, meters_df)
    if not force and signature == _cached_data_signature:
        return

    # Phase 2.1: Gap Detection
    gap_df = compute_gaps(feeder_df, meters_df)

    # Phase 2.2: Anomaly Scoring
    anomaly_results = score_all_meters(meters_df, models_dir=str(_models_dir))

    # Phase 2.3: Classification
    classifications = {}
    for meter_id in meters_df["meter_id"].unique():
        m_df = meters_df[meters_df["meter_id"] == meter_id].copy()
        m_df["timestamp"] = pd.to_datetime(m_df["timestamp"])
        start_time = m_df["timestamp"].min()
        baseline_df = m_df[m_df["timestamp"] < start_time + pd.Timedelta(days=3)]

        classifications[meter_id] = classify_loss_type(
            meter_id, m_df, gap_df, baseline_df
        )

    cluster_tampering_meters = detect_cluster_tampering(meters_df)
    for meter_id in cluster_tampering_meters:
        if classifications.get(meter_id, {}).get("type") == "faulty_meter":
            continue
        existing = classifications.get(meter_id, {})
        confidence = max(float(existing.get("confidence", 0.0)), 0.82)
        classifications[meter_id] = {
            "type": "meter_tampering",
            "confidence": min(confidence, 0.95),
            "reasoning": (
                "Meter is part of a same-day consumption drop across nearby meters, "
                "indicating coordinated meter tampering."
            ),
        }

    _apply_simulation_classification_overrides(classifications)

    # Phase 2.4: Ranking
    _cached_alerts = rank_meters(anomaly_results, classifications, gap_df, meters_df)
    _cached_data_signature = signature


@asynccontextmanager
async def lifespan(_app: FastAPI):
    data_loader.load_data()
    run_detection_pipeline()
    yield


app = FastAPI(title="GridSense API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/simulate/theft")
def simulate_theft(req: SimulationRequest):
    if data_loader.meters_df is None or data_loader.meters_df.empty:
        raise HTTPException(status_code=404, detail="No data available")

    _ensure_simulation_baseline()
    source_df = _simulation_baseline_meters_df
    if source_df is None or source_df.empty:
        raise HTTPException(status_code=404, detail="No data available")

    if req.meter_id not in source_df["meter_id"].unique():
        raise HTTPException(status_code=404, detail=f"Meter {req.meter_id} not found")

    _active_simulations[req.meter_id] = req
    _apply_active_simulations_to_data()

    _record_simulation_event(
        "theft",
        meter_id=req.meter_id,
        type=req.type,
        intensity=req.intensity,
        readings_affected=_simulation_window_readings,
    )

    # Trigger re-detection
    run_detection_pipeline(force=True)

    # Return the updated alert
    alert = next((a for a in _cached_alerts if a.meter_id == req.meter_id), None)
    return alert or {
        "status": "injected",
        "message": "Anomaly injected but not yet detected as critical alert",
    }


@app.post("/api/simulate/reset")
def simulate_reset():
    global _simulation_baseline_meters_df
    _active_simulations.clear()
    data_loader.load_data()
    _set_simulation_baseline_from_current()
    run_detection_pipeline(force=True)
    _record_simulation_event("reset")
    return {"status": "reset"}


@app.get("/api/simulate/events")
def get_simulation_events(limit: int = Query(50, gt=0)):
    try:
        actual_limit = int(limit)
    except (TypeError, ValueError):
        actual_limit = 50

    return _simulation_events[-actual_limit:]


@app.get("/health")
def health_check():
    database = check_database_connection()
    if database["status"] == "error":
        raise HTTPException(
            status_code=503,
            detail={"status": "degraded", "database": database},
        )

    return {
        "status": "ok",
        "data_source": "database" if database["status"] == "ok" else "csv",
        "database": database,
    }


@app.get("/api/feeder/{feeder_id}/readings", response_model=List[Reading])
def get_feeder_readings(
    feeder_id: str, start: Optional[str] = None, end: Optional[str] = None
):
    if data_loader.feeder_df is None or data_loader.feeder_df.empty:
        raise HTTPException(status_code=404, detail="No data available")

    df = data_loader.feeder_df

    if feeder_id not in df["feeder_id"].unique() and feeder_id != "F001":
        raise HTTPException(status_code=404, detail="Feeder not found")

    df_filtered = df[df["feeder_id"] == feeder_id].copy()

    if start or end:
        df_filtered["ts_dt"] = pd.to_datetime(df_filtered["timestamp"])
        if start:
            try:
                start_dt = pd.to_datetime(start)
                df_filtered = df_filtered[df_filtered["ts_dt"] >= start_dt]
            except Exception:
                raise HTTPException(status_code=422, detail="Invalid start date format")
        if end:
            try:
                end_dt = pd.to_datetime(end)
                df_filtered = df_filtered[df_filtered["ts_dt"] < end_dt]
            except Exception:
                raise HTTPException(status_code=422, detail="Invalid end date format")
        df_filtered = df_filtered.drop(columns=["ts_dt"])

    return df_filtered.to_dict(orient="records")


@app.get("/api/alerts", response_model=List[Alert])
def get_alerts(limit: int = Query(10, gt=0)):
    try:
        actual_limit = int(limit)
    except (TypeError, ValueError):
        actual_limit = 10
    result = []
    for a in _cached_alerts[:actual_limit]:
        d = a.model_dump()
        d["status"] = _alert_statuses.get(a.meter_id, "open")
        result.append(Alert(**d))
    return result


@app.post("/api/alerts/{meter_id}/inspect")
def inspect_alert(meter_id: str):
    alert = next((a for a in _cached_alerts if a.meter_id == meter_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    _alert_statuses[meter_id] = "inspecting"
    d = alert.model_dump()
    d["status"] = "inspecting"
    return {"status": "ok", "alert": Alert(**d)}


@app.post("/api/alerts/{meter_id}/dismiss")
def dismiss_alert(meter_id: str):
    alert = next((a for a in _cached_alerts if a.meter_id == meter_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    _alert_statuses[meter_id] = "dismissed"
    d = alert.model_dump()
    d["status"] = "dismissed"
    return {"status": "ok", "alert": Alert(**d)}


@app.post("/api/alerts/{meter_id}/resolve")
def resolve_alert(meter_id: str):
    alert = next((a for a in _cached_alerts if a.meter_id == meter_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    _alert_statuses[meter_id] = "resolved"
    d = alert.model_dump()
    d["status"] = "resolved"
    return {"status": "ok", "alert": Alert(**d)}


@app.get("/api/alerts/{meter_id}", response_model=Alert)
def get_alert_by_meter(meter_id: str):
    alert = next((a for a in _cached_alerts if a.meter_id == meter_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert for meter not found")
    return alert


@app.get("/api/meters", response_model=List[Meter])
def get_meters():
    if data_loader.meters_df is None or data_loader.meters_df.empty:
        return []
    # Just return the unique meters with their coords
    unique_meters = data_loader.meters_df.drop_duplicates(subset=["meter_id"])
    return unique_meters[["meter_id", "lat", "lng"]].to_dict(orient="records")


@app.get("/api/feeder/{feeder_id}/gap_stats")
def get_gap_stats(feeder_id: str):
    if data_loader.feeder_df is None or data_loader.meters_df is None:
        return []

    feeder_df = data_loader.feeder_df[
        data_loader.feeder_df["feeder_id"] == feeder_id
    ].copy()
    if feeder_df.empty:
        return []

    gap_df = compute_gaps(feeder_df, data_loader.meters_df)

    result = []
    for _, row in gap_df.iterrows():
        result.append(
            {
                "timestamp": row["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                "feeder_kwh": float(row["feeder_kwh"]),
                "meters_sum_kwh": float(row["meter_sum_kwh"]),
                "gap_kwh": float(row["gap_kwh"]),
                "gap_ratio": float(row["gap_ratio"]),
            }
        )
    return result


@app.get("/api/meters/{meter_id}/history", response_model=List[Reading])
def get_meter_history(meter_id: str):
    if data_loader.meters_df is None or data_loader.meters_df.empty:
        raise HTTPException(status_code=404, detail="No meter data available")

    if "meter_id" not in data_loader.meters_df.columns:
        raise HTTPException(status_code=404, detail="Meter ID column not found")

    df = data_loader.meters_df[data_loader.meters_df["meter_id"] == meter_id].copy()
    if df.empty:
        raise HTTPException(status_code=404, detail="Meter not found")

    return df.to_dict(orient="records")
