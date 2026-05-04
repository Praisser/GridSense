import pandas as pd
import numpy as np
import os
import joblib
from sklearn.exceptions import InconsistentVersionWarning
from app.detection.meter_scorer import (
    extract_features,
    train_meter_model,
    score_meter,
    score_all_meters,
)


def test_extract_features_shape():
    # T2.2.1: extract_features output shape
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2024-01-01", periods=10, freq="15min"),
            "kwh": np.random.rand(10),
        }
    )
    features = extract_features(df)
    assert features.shape == (10, 5)


def test_extract_features_imputes_nan_inputs():
    # T2.2.2: extract_features with NaN inputs
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2024-01-01", periods=10, freq="15min"),
            "kwh": [0.2, 0.3, np.nan, 0.4, np.nan, 0.5, 0.6, 0.5, 0.4, 0.3],
        }
    )

    features = extract_features(df)

    assert features.shape == (10, 5)
    assert np.isfinite(features).all()


def test_train_model_identical_readings():
    # T2.2.3: Train model on identical readings
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2024-01-01", periods=100, freq="15min"),
            "kwh": [0.1] * 100,
        }
    )
    model = train_meter_model(df, train_days=1)
    assert model is not None


def test_score_normal_meter():
    # T2.2.4: Score normal meter against own baseline
    # Create 4 days of data. Use first 3 for training (implicitly in score_all_meters or manually)
    dates = pd.date_range("2024-01-01", periods=96 * 4, freq="15min")
    kwh = np.random.normal(0.5, 0.05, 96 * 4)
    df = pd.DataFrame({"timestamp": dates, "kwh": kwh})

    model = train_meter_model(df, train_days=3)
    scores = score_meter(model, df)

    # Normal readings should have relatively low anomaly scores
    assert scores["anomaly_score"].mean() < 0.5


def test_persistence(tmp_path):
    # T2.2.7: Save and reload model
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2024-01-01", periods=100, freq="15min"),
            "kwh": np.random.rand(100),
        }
    )
    model = train_meter_model(df, train_days=1)

    model_dir = tmp_path / "models"
    model_dir.mkdir()
    model_path = model_dir / "M01.joblib"

    joblib.dump(model, model_path)
    loaded_model = joblib.load(model_path)

    scores1 = score_meter(model, df)
    scores2 = score_meter(loaded_model, df)

    pd.testing.assert_series_equal(scores1["anomaly_score"], scores2["anomaly_score"])


def test_score_all_meters(tmp_path):
    # T2.2.8: Performance/Functionality check
    dates = pd.date_range("2024-01-01", periods=96 * 4, freq="15min")
    df1 = pd.DataFrame(
        {"timestamp": dates, "meter_id": "M01", "kwh": np.random.rand(len(dates))}
    )
    df2 = pd.DataFrame(
        {"timestamp": dates, "meter_id": "M02", "kwh": np.random.rand(len(dates))}
    )
    meters_df = pd.concat([df1, df2])

    model_dir = str(tmp_path / "models")
    results = score_all_meters(meters_df, models_dir=model_dir)

    assert "M01" in results
    assert "M02" in results
    assert len(results["M01"]) == len(dates)
    assert os.path.exists(os.path.join(model_dir, "M01.joblib"))


def test_score_all_meters_retrains_incompatible_cached_model(tmp_path, monkeypatch):
    dates = pd.date_range("2024-01-01", periods=96 * 4, freq="15min")
    meters_df = pd.DataFrame(
        {"timestamp": dates, "meter_id": "M01", "kwh": np.random.rand(len(dates))}
    )
    model_dir = tmp_path / "models"
    model_dir.mkdir()
    (model_dir / "M01.joblib").write_bytes(b"stale-model")

    def raise_inconsistent_version(_path):
        raise InconsistentVersionWarning(
            estimator_name="IsolationForest",
            current_sklearn_version="1.8.0",
            original_sklearn_version="1.7.2",
        )

    monkeypatch.setattr(joblib, "load", raise_inconsistent_version)

    results = score_all_meters(meters_df, models_dir=str(model_dir))

    assert "M01" in results
    assert len(results["M01"]) == len(dates)
    assert (model_dir / "M01.joblib").stat().st_size > len(b"stale-model")
