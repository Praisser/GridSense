import pandas as pd
from app.detection.gap_detector import compute_gaps, flag_gap_windows


def test_compute_gaps_zero_gap():
    # T2.1.1: compute_gaps with identical feeder=meter sum
    feeder_df = pd.DataFrame(
        {
            "timestamp": ["2024-01-01 00:00:00", "2024-01-01 00:15:00"],
            "feeder_id": ["F001", "F001"],
            "kwh": [1.0, 1.0],
        }
    )
    meters_df = pd.DataFrame(
        {
            "timestamp": [
                "2024-01-01 00:00:00",
                "2024-01-01 00:00:00",
                "2024-01-01 00:15:00",
            ],
            "meter_id": ["M01", "M02", "M01"],
            "kwh": [0.5, 0.5, 1.0],
        }
    )

    result = compute_gaps(feeder_df, meters_df)
    assert len(result) == 2
    assert all(result["gap_ratio"] == 0)
    assert all(result["gap_kwh"] == 0)


def test_compute_gaps_half_gap():
    # T2.1.2: compute_gaps with feeder=2× meter sum
    feeder_df = pd.DataFrame(
        {"timestamp": ["2024-01-01 00:00:00"], "feeder_id": ["F001"], "kwh": [2.0]}
    )
    meters_df = pd.DataFrame(
        {"timestamp": ["2024-01-01 00:00:00"], "meter_id": ["M01"], "kwh": [1.0]}
    )

    result = compute_gaps(feeder_df, meters_df)
    assert result.iloc[0]["gap_ratio"] == 0.5
    assert result.iloc[0]["gap_kwh"] == 1.0


def test_flag_gap_windows_no_anomalies():
    # T2.1.3: flag_gap_windows with all values < threshold
    gap_df = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(["2024-01-01 00:00:00", "2024-01-01 00:15:00"]),
            "gap_ratio": [0.05, 0.06],
            "gap_kwh": [0.1, 0.12],
        }
    )

    result = flag_gap_windows(gap_df, threshold=0.07)
    assert result == []


def test_flag_gap_windows_single_spike():
    # T2.1.4: flag_gap_windows with one continuous spike
    gap_df = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(
                ["2024-01-01 00:00:00", "2024-01-01 00:15:00", "2024-01-01 00:30:00"]
            ),
            "gap_ratio": [0.05, 0.1, 0.05],
            "gap_kwh": [0.1, 0.2, 0.1],
        }
    )

    result = flag_gap_windows(gap_df, threshold=0.07)
    assert len(result) == 1
    assert result[0].peak_gap_ratio == 0.1
    assert result[0].total_kwh_lost == 0.2


def test_flag_gap_windows_two_spikes():
    # T2.1.5: flag_gap_windows with two separate spikes
    gap_df = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(
                [
                    "2024-01-01 00:00:00",
                    "2024-01-01 00:15:00",
                    "2024-01-01 00:30:00",
                    "2024-01-01 00:45:00",
                    "2024-01-01 01:00:00",
                ]
            ),
            "gap_ratio": [0.1, 0.1, 0.05, 0.15, 0.15],
            "gap_kwh": [0.2, 0.2, 0.1, 0.3, 0.3],
        }
    )

    result = flag_gap_windows(gap_df, threshold=0.07)
    assert len(result) == 2
    assert result[0].total_kwh_lost == 0.4
    assert result[1].total_kwh_lost == 0.6


def test_flag_gap_windows_empty():
    # T2.1.6: Empty input DataFrame
    result = flag_gap_windows(pd.DataFrame(), threshold=0.07)
    assert result == []


def test_flag_gap_windows_single_row():
    # T2.1.7: Single row input
    gap_df = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(["2024-01-01 00:00:00"]),
            "gap_ratio": [0.1],
            "gap_kwh": [0.2],
        }
    )
    result = flag_gap_windows(gap_df, threshold=0.07)
    assert len(result) == 1
    assert result[0].total_kwh_lost == 0.2
