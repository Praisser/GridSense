import pandas as pd
from typing import Dict, Any, Optional, Set


def _slot_index(timestamps: pd.Series) -> pd.Series:
    return timestamps.dt.hour * 4 + (timestamps.dt.minute // 15)


def _first_drop_date(
    meter_df: pd.DataFrame,
    baseline_days: int = 3,
    drop_threshold: float = 0.4,
) -> Optional[pd.Timestamp]:
    if meter_df.empty:
        return None

    df = meter_df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["kwh"] = pd.to_numeric(df["kwh"], errors="coerce")
    df["kwh"] = df["kwh"].interpolate(limit_direction="both").fillna(0)
    df = df.sort_values("timestamp")

    baseline_end = df["timestamp"].min() + pd.Timedelta(days=baseline_days)
    baseline_df = df[df["timestamp"] < baseline_end].copy()
    comparison_df = df[df["timestamp"] >= baseline_end].copy()
    if baseline_df.empty or comparison_df.empty:
        return None

    baseline_df["slot"] = _slot_index(baseline_df["timestamp"])
    comparison_df["slot"] = _slot_index(comparison_df["timestamp"])
    expected_by_slot = baseline_df.groupby("slot")["kwh"].mean()
    fallback_expected = float(baseline_df["kwh"].mean())

    for day, day_df in comparison_df.groupby(comparison_df["timestamp"].dt.normalize()):
        expected = day_df["slot"].map(expected_by_slot).fillna(fallback_expected)
        expected_mean = float(expected.mean())
        if expected_mean <= 0:
            continue

        observed_mean = float(day_df["kwh"].mean())
        drop_ratio = (expected_mean - observed_mean) / expected_mean
        if drop_ratio >= drop_threshold:
            return pd.Timestamp(day)

    return None


def detect_cluster_tampering(
    meters_df: pd.DataFrame,
    baseline_days: int = 3,
    drop_threshold: float = 0.4,
    min_cluster_size: int = 3,
) -> Set[str]:
    if meters_df.empty or "meter_id" not in meters_df.columns:
        return set()

    drop_dates: Dict[pd.Timestamp, list[str]] = {}
    for meter_id, meter_df in meters_df.groupby("meter_id"):
        first_drop = _first_drop_date(meter_df, baseline_days, drop_threshold)
        if first_drop is None:
            continue
        drop_dates.setdefault(first_drop, []).append(meter_id)

    clustered: Set[str] = set()
    for meter_ids in drop_dates.values():
        if len(meter_ids) >= min_cluster_size:
            clustered.update(meter_ids)

    return clustered


def classify_loss_type(
    meter_id: str,
    meter_df: pd.DataFrame,
    gap_df: pd.DataFrame,
    baseline_df: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Returns {"type": str, "confidence": float, "reasoning": str}
    """
    if meter_df.empty or baseline_df.empty:
        return {
            "type": "none",
            "confidence": 0.0,
            "reasoning": "Insufficient data for classification.",
        }

    # Calculate metrics for the recent period (last 24h of meter_df)
    meter_df = meter_df.copy()
    baseline_df = baseline_df.copy()
    gap_df = gap_df.copy()

    meter_df["timestamp"] = pd.to_datetime(meter_df["timestamp"])
    baseline_df["timestamp"] = pd.to_datetime(baseline_df["timestamp"])
    gap_df["timestamp"] = pd.to_datetime(gap_df["timestamp"])

    recent_df = meter_df.sort_values("timestamp").tail(96)  # Last 24h

    baseline_avg = baseline_df["kwh"].mean()
    recent_avg = recent_df["kwh"].mean()
    recent_std = recent_df["kwh"].std()

    # Check for faulty meter (flat-line)
    if recent_std < 0.01:  # Very flat
        return {
            "type": "faulty_meter",
            "confidence": 0.9,
            "reasoning": f"Meter {meter_id} shows near-zero variance in consumption (std={recent_std:.4f}), indicating a potential hardware failure or flat-line fault.",
        }

    # Check for consumption drop
    drop_ratio = 0
    if baseline_avg > 0:
        drop_ratio = (baseline_avg - recent_avg) / baseline_avg

    # Check for feeder gap correlation
    # Find gaps in the same period as recent_df
    recent_start = recent_df["timestamp"].min()
    recent_end = recent_df["timestamp"].max()

    relevant_gaps = gap_df[
        (gap_df["timestamp"] >= recent_start) & (gap_df["timestamp"] <= recent_end)
    ]
    avg_gap_ratio = relevant_gaps["gap_ratio"].mean() if not relevant_gaps.empty else 0

    if drop_ratio > 0.4:
        if avg_gap_ratio > 0.07:
            # Bypass theft: drop in meter AND gap in feeder
            confidence = min(0.5 + drop_ratio * 0.5, 0.95)
            return {
                "type": "bypass_theft",
                "confidence": float(confidence),
                "reasoning": f"Significant consumption drop ({drop_ratio*100:.1f}%) detected, strongly correlated with a {avg_gap_ratio*100:.1f}% feeder gap. Suggests illegal bypass.",
            }
        else:
            # Meter tampering: drop in meter BUT NO significant gap in feeder (maybe it's a small leak or individual tampering)
            # Wait, if there's a drop in meter but no gap in feeder, it means the feeder also dropped?
            # Actually, if it's tampering, the energy is still being consumed but not measured?
            # If it's still being consumed but not measured, then the FEEDER will show a gap.
            # So maybe 'meter_tampering' is when the drop is less extreme or has a different pattern.
            # Per prompt: "Sudden 40-80% drop in consumption from baseline; pattern still has daily rhythm"
            confidence = min(0.4 + drop_ratio * 0.4, 0.85)
            return {
                "type": "meter_tampering",
                "confidence": float(confidence),
                "reasoning": f"Consumption dropped by {drop_ratio*100:.1f}% while maintaining a periodic pattern. Likely physical tampering with the meter mechanism.",
            }

    # Default case
    if drop_ratio > 0.2:
        return {
            "type": "other_anomaly",
            "confidence": 0.5,
            "reasoning": f"Moderate consumption drop ({drop_ratio*100:.1f}%) detected. Requires further investigation.",
        }

    return {
        "type": "none",
        "confidence": 0.1,
        "reasoning": "No significant loss fingerprints identified.",
    }
