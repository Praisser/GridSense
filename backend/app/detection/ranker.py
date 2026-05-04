import pandas as pd
from typing import List, Dict, Any
from ..models import Alert


def _slot_index(timestamps: pd.Series) -> pd.Series:
    return timestamps.dt.hour * 4 + (timestamps.dt.minute // 15)


def estimate_meter_loss_kwh(meter_df: pd.DataFrame, baseline_days: int = 3) -> float:
    if meter_df.empty or not {"timestamp", "kwh"}.issubset(meter_df.columns):
        return 0.0

    df = meter_df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["kwh"] = pd.to_numeric(df["kwh"], errors="coerce")
    df["kwh"] = df["kwh"].interpolate(limit_direction="both").fillna(0)
    df = df.sort_values("timestamp")

    baseline_end = df["timestamp"].min() + pd.Timedelta(days=baseline_days)
    baseline_df = df[df["timestamp"] < baseline_end].copy()
    comparison_df = df[df["timestamp"] >= baseline_end].copy()
    if baseline_df.empty or comparison_df.empty:
        return 0.0

    baseline_df["slot"] = _slot_index(baseline_df["timestamp"])
    comparison_df["slot"] = _slot_index(comparison_df["timestamp"])
    expected_by_slot = baseline_df.groupby("slot")["kwh"].mean()
    fallback_expected = float(baseline_df["kwh"].mean())
    expected = comparison_df["slot"].map(expected_by_slot).fillna(fallback_expected)

    lost_kwh = (expected - comparison_df["kwh"]).clip(lower=0).sum()
    return float(lost_kwh)


def rank_meters(
    anomaly_results: Dict[str, pd.DataFrame],
    classifications: Dict[str, Dict[str, Any]],
    gap_df: pd.DataFrame,
    meters_df: pd.DataFrame,
) -> List[Alert]:
    """
    Composite score: 0.4 × anomaly_score + 0.4 × classification_confidence + 0.2 × gap_contribution
    Sorts descending by composite score.
    """
    alerts = []

    # Get meter locations
    meter_locs = (
        meters_df[["meter_id", "lat", "lng"]]
        .drop_duplicates()
        .set_index("meter_id")
        .to_dict("index")
    )
    meter_losses = {
        meter_id: estimate_meter_loss_kwh(m_df)
        for meter_id, m_df in meters_df.groupby("meter_id")
    }
    max_loss = max(meter_losses.values(), default=0.0)

    for meter_id, anomaly_df in anomaly_results.items():
        classification = classifications.get(
            meter_id,
            {
                "type": "none",
                "confidence": 0.0,
                "reasoning": "No classification data available.",
            },
        )

        # Only include meters that have some anomaly or are classified as a loss type
        if classification["type"] == "none" and classification["confidence"] < 0.2:
            continue

        # Recent anomaly score (max in last 24h)
        recent_df = anomaly_df.tail(96)
        recent_anomaly = recent_df["anomaly_score"].max() if not recent_df.empty else 0

        # Gap contribution: normalize this meter's estimated unmetered energy
        # against the most impacted meter in the current dataset.
        total_kwh_lost = meter_losses.get(meter_id, 0.0)
        gap_contribution = total_kwh_lost / max_loss if max_loss > 0 else 0.0

        recent_gap_df = gap_df.tail(96)
        recent_gap = recent_gap_df["gap_ratio"].mean() if not recent_gap_df.empty else 0
        gap_contribution = max(
            gap_contribution, min(float(recent_gap), 1.0) if total_kwh_lost > 0 else 0.0
        )

        composite_score = (
            (0.4 * recent_anomaly)
            + (0.4 * classification["confidence"])
            + (0.2 * gap_contribution)
        )

        # Get last anomaly timestamp
        last_anomaly = anomaly_df[anomaly_df["is_anomaly"]]["timestamp"].max()
        if pd.isna(last_anomaly):
            last_anomaly = anomaly_df["timestamp"].max()

        loc = meter_locs.get(meter_id, {"lat": 0.0, "lng": 0.0})

        alerts.append(
            Alert(
                meter_id=meter_id,
                lat=loc["lat"],
                lng=loc["lng"],
                loss_type=classification["type"],
                confidence=float(classification["confidence"]),
                reasoning=classification["reasoning"],
                last_anomaly_at=str(last_anomaly),
                total_kwh_lost=round(total_kwh_lost, 3),
                composite_score=float(composite_score),
            )
        )

    # Sort descending by composite score
    alerts.sort(key=lambda x: x.composite_score, reverse=True)

    return alerts
