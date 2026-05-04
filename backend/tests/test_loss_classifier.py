import pytest
import pandas as pd
import numpy as np
from app.detection.loss_classifier import classify_loss_type


@pytest.fixture
def baseline_data():
    dates = pd.date_range("2024-01-01", periods=96 * 3, freq="15min")
    kwh = [1.0] * (96 * 3)
    return pd.DataFrame({"timestamp": dates, "kwh": kwh})


@pytest.fixture
def empty_gap_df():
    return pd.DataFrame(columns=["timestamp", "gap_ratio"])


def test_classify_faulty_meter(baseline_data, empty_gap_df):
    # T2.3.1: Flat-line input
    dates = pd.date_range("2024-01-04", periods=96, freq="15min")
    kwh = [0.1] * 96  # Flat
    meter_df = pd.DataFrame({"timestamp": dates, "kwh": kwh})

    result = classify_loss_type("M13", meter_df, empty_gap_df, baseline_data)
    assert result["type"] == "faulty_meter"
    assert result["confidence"] >= 0.8
    assert len(result["reasoning"]) > 20


def test_classify_bypass_theft(baseline_data):
    # T2.3.2: 60% drop with feeder gap
    dates = pd.date_range("2024-01-04", periods=96, freq="15min")
    kwh = np.random.normal(0.4, 0.05, 96)  # 60% drop from 1.0
    meter_df = pd.DataFrame({"timestamp": dates, "kwh": kwh})

    gap_df = pd.DataFrame({"timestamp": dates, "gap_ratio": [0.15] * 96})

    result = classify_loss_type("M07", meter_df, gap_df, baseline_data)
    assert result["type"] == "bypass_theft"
    assert result["confidence"] > 0.7


def test_classify_meter_tampering(baseline_data, empty_gap_df):
    # T2.3.3: 50% drop without feeder gap
    dates = pd.date_range("2024-01-04", periods=96, freq="15min")
    kwh = np.random.normal(0.5, 0.05, 96)  # 50% drop
    meter_df = pd.DataFrame({"timestamp": dates, "kwh": kwh})

    result = classify_loss_type("M08", meter_df, empty_gap_df, baseline_data)
    assert result["type"] == "meter_tampering"
    assert result["confidence"] > 0.5


def test_classify_normal(baseline_data, empty_gap_df):
    # T2.3.4: Normal meter input
    dates = pd.date_range("2024-01-04", periods=96, freq="15min")
    kwh = np.random.normal(0.95, 0.05, 96)  # 5% drop
    meter_df = pd.DataFrame({"timestamp": dates, "kwh": kwh})

    result = classify_loss_type("M01", meter_df, empty_gap_df, baseline_data)
    assert result["type"] == "none"
    assert result["confidence"] < 0.2


def test_output_constraints(baseline_data, empty_gap_df):
    # T2.3.6 & T2.3.7
    dates = pd.date_range("2024-01-04", periods=96, freq="15min")
    kwh = np.random.normal(0.2, 0.05, 96)
    meter_df = pd.DataFrame({"timestamp": dates, "kwh": kwh})

    result = classify_loss_type("M99", meter_df, empty_gap_df, baseline_data)
    assert 0.0 <= result["confidence"] <= 1.0
    assert 20 <= len(result["reasoning"]) <= 200
