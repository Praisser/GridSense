import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import joblib
import os
import warnings
from typing import Dict
from sklearn.exceptions import InconsistentVersionWarning


def extract_features(meter_df: pd.DataFrame) -> np.ndarray:
    """
    Per-window features: kwh, hour_of_day, day_of_week, rolling_mean_24h, rolling_std_24h
    """
    if meter_df.empty:
        return np.array([])

    df = meter_df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")
    df["kwh"] = pd.to_numeric(df["kwh"], errors="coerce")
    df["kwh"] = df["kwh"].interpolate(limit_direction="both").fillna(0)

    df["hour_of_day"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek

    # Calculate rolling features (assuming 15-min intervals, so 4*24 = 96 windows for 24h)
    df["rolling_mean_24h"] = df["kwh"].rolling(window=96, min_periods=1).mean()
    df["rolling_std_24h"] = df["kwh"].rolling(window=96, min_periods=1).std().fillna(0)

    features = df[
        ["kwh", "hour_of_day", "day_of_week", "rolling_mean_24h", "rolling_std_24h"]
    ].values
    return features


def train_meter_model(meter_df: pd.DataFrame, train_days: int = 3) -> IsolationForest:
    """
    Train an Isolation Forest on its first X days of consumption.
    """
    if meter_df.empty:
        raise ValueError("Cannot train model on empty data")

    df = meter_df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")

    start_time = df["timestamp"].min()
    end_train_time = start_time + pd.Timedelta(days=train_days)

    train_df = df[df["timestamp"] < end_train_time]

    X_train = extract_features(train_df)

    # contamination 'auto' or a small value like 0.01 for baseline assumed clean
    model = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
    model.fit(X_train)

    return model


def score_meter(model: IsolationForest, meter_df: pd.DataFrame) -> pd.DataFrame:
    """
    Score the meter data. Higher anomaly score = more suspicious.
    In sklearn's IsolationForest, decision_function returns the anomaly score.
    Lower values mean more anomalous. We'll invert it or normalize it as requested.
    "Higher anomaly score = more suspicious"
    """
    if meter_df.empty:
        return pd.DataFrame(columns=["timestamp", "anomaly_score", "is_anomaly"])

    X = extract_features(meter_df)

    # decision_function: The anomaly score of the input samples is computed as the mean anomaly score of the trees in the forest.
    # The measure of normality of an observation given a tree is the equivalent to the path length in an isolation tree.
    # Scores are centered at 0. Negative values indicate anomalies.
    raw_scores = model.decision_function(X)

    # Convert to a 0-1 range where 1 is most anomalous
    # Typical range is [-0.5, 0.5] approx.
    # Let's use a simple heuristic: score = (0.5 - raw_score)
    # Or just return raw and handle in ranker.
    # The requirement says "Higher anomaly score = more suspicious".
    # Let's normalize it a bit.
    normalized_scores = 0.5 - raw_scores
    normalized_scores = np.clip(normalized_scores, 0, 1)

    is_anomaly = model.predict(X) == -1

    result = meter_df[["timestamp"]].copy()
    result["anomaly_score"] = normalized_scores
    result["is_anomaly"] = is_anomaly

    return result


def score_all_meters(
    meters_df: pd.DataFrame, models_dir: str = "backend/models"
) -> Dict[str, pd.DataFrame]:
    """
    Score all meters, training/loading models as needed.
    """
    os.makedirs(models_dir, exist_ok=True)

    results = {}
    meter_ids = meters_df["meter_id"].unique()

    for meter_id in meter_ids:
        m_df = meters_df[meters_df["meter_id"] == meter_id]
        model_path = os.path.join(models_dir, f"{meter_id}.joblib")

        should_train = True
        if os.path.exists(model_path):
            try:
                with warnings.catch_warnings():
                    warnings.filterwarnings(
                        "error", category=InconsistentVersionWarning
                    )
                    model = joblib.load(model_path)
                should_train = False
            except InconsistentVersionWarning:
                should_train = True

        if should_train:
            model = train_meter_model(m_df)
            joblib.dump(model, model_path)

        results[meter_id] = score_meter(model, m_df)

    return results
