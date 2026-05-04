import pandas as pd
from app.detection.ranker import rank_meters


def test_rank_meters_sorting():
    # T2.4.2: Sorting by composite score
    anomaly_results = {
        "M01": pd.DataFrame(
            {"timestamp": ["2024-01-01"], "anomaly_score": [0.1], "is_anomaly": [False]}
        ),
        "M07": pd.DataFrame(
            {"timestamp": ["2024-01-01"], "anomaly_score": [0.8], "is_anomaly": [True]}
        ),
    }
    classifications = {
        "M01": {"type": "none", "confidence": 0.1, "reasoning": "Normal"},
        "M07": {
            "type": "bypass_theft",
            "confidence": 0.9,
            "reasoning": "Theft detected",
        },
    }
    gap_df = pd.DataFrame({"timestamp": ["2024-01-01"], "gap_ratio": [0.1]})
    meters_df = pd.DataFrame(
        {"meter_id": ["M01", "M07"], "lat": [12.0, 13.0], "lng": [77.0, 78.0]}
    )

    alerts = rank_meters(anomaly_results, classifications, gap_df, meters_df)

    assert len(alerts) >= 1
    assert alerts[0].meter_id == "M07"
    assert alerts[0].composite_score > 0.5
