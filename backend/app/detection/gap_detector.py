import pandas as pd
from typing import List
from dataclasses import dataclass


@dataclass
class GapWindow:
    start: str
    end: str
    peak_gap_ratio: float
    total_kwh_lost: float


def compute_gaps(feeder_df: pd.DataFrame, meters_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aligns timestamps between feeder and aggregated meter data.
    Returns DataFrame with columns: timestamp, feeder_kwh, meter_sum_kwh, gap_kwh, gap_ratio
    """
    if feeder_df.empty or meters_df.empty:
        return pd.DataFrame(
            columns=["timestamp", "feeder_kwh", "meter_sum_kwh", "gap_kwh", "gap_ratio"]
        )

    # Work on copies to avoid side effects
    feeder_df = feeder_df.copy()
    meters_df = meters_df.copy()

    # Ensure timestamps are datetime
    feeder_df["timestamp"] = pd.to_datetime(feeder_df["timestamp"])
    meters_df["timestamp"] = pd.to_datetime(meters_df["timestamp"])

    # Aggregate meter readings by timestamp
    meter_agg = meters_df.groupby("timestamp")["kwh"].sum().reset_index()
    meter_agg.rename(columns={"kwh": "meter_sum_kwh"}, inplace=True)

    # Merge with feeder data
    gap_df = pd.merge(feeder_df, meter_agg, on="timestamp", how="inner")
    gap_df.rename(columns={"kwh": "feeder_kwh"}, inplace=True)

    gap_df["gap_kwh"] = gap_df["feeder_kwh"] - gap_df["meter_sum_kwh"]
    # Avoid division by zero
    gap_df["gap_ratio"] = gap_df["gap_kwh"] / gap_df["feeder_kwh"].replace(
        0, float("nan")
    )
    gap_df["gap_ratio"] = gap_df["gap_ratio"].fillna(0)

    return gap_df[["timestamp", "feeder_kwh", "meter_sum_kwh", "gap_kwh", "gap_ratio"]]


def flag_gap_windows(gap_df: pd.DataFrame, threshold: float = 0.07) -> List[GapWindow]:
    """
    Returns contiguous time windows where gap_ratio > threshold.
    """
    if gap_df.empty:
        return []

    gap_df = gap_df.copy()
    gap_df["is_anomaly"] = gap_df["gap_ratio"] > threshold

    # Find contiguous blocks of anomalies
    gap_df["block"] = (gap_df["is_anomaly"] != gap_df["is_anomaly"].shift()).cumsum()

    windows = []
    # Filter only anomaly blocks
    anomaly_blocks = gap_df[gap_df["is_anomaly"]]

    if anomaly_blocks.empty:
        return []

    for _, block_df in anomaly_blocks.groupby("block"):
        windows.append(
            GapWindow(
                start=block_df["timestamp"].min().isoformat(),
                end=block_df["timestamp"].max().isoformat(),
                peak_gap_ratio=float(block_df["gap_ratio"].max()),
                total_kwh_lost=float(block_df["gap_kwh"].sum()),
            )
        )

    return windows
