from fastapi.testclient import TestClient
from app.data_loader import data_loader
from app.main import app, get_alerts, get_gap_stats, run_detection_pipeline
from data import generator

client = TestClient(app)


def _refresh_detection():
    generator.generate_data()
    data_loader.load_data()
    run_detection_pipeline(force=True)


def test_get_alerts():
    # T2.4.1: GET /api/alerts
    _refresh_detection()
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) >= 3


def test_get_alerts_limit():
    # T2.4.3: GET /api/alerts?limit=5
    _refresh_detection()
    response = client.get("/api/alerts?limit=5")
    assert response.status_code == 200
    assert len(response.json()) == 5


def test_get_alert_by_id():
    _refresh_detection()
    response = client.get("/api/alerts/M07")
    assert response.status_code == 200
    assert response.json()["meter_id"] == "M07"


def test_get_invalid_alert():
    _refresh_detection()
    response = client.get("/api/alerts/INVALID_METER")
    assert response.status_code == 404


def test_full_pipeline_ranks_expected_anomalies():
    _refresh_detection()

    alerts = get_alerts(10)
    by_meter = {alert.meter_id: alert for alert in alerts}
    top_three = {alert.meter_id for alert in alerts[:3]}

    assert 3 <= len(alerts) <= 7
    assert {"M07", "M13"}.issubset(top_three)
    assert by_meter["M07"].loss_type == "bypass_theft"
    assert by_meter["M07"].confidence > 0.7
    assert by_meter["M13"].loss_type == "faulty_meter"
    assert by_meter["M13"].confidence > 0.8

    for meter_id in ("M15", "M16", "M17", "M18"):
        assert by_meter[meter_id].loss_type == "meter_tampering"


def test_alerts_include_positive_estimated_loss_and_required_fields():
    _refresh_detection()

    alerts = get_alerts(10)
    required_fields = {
        "meter_id",
        "lat",
        "lng",
        "loss_type",
        "confidence",
        "reasoning",
        "last_anomaly_at",
        "total_kwh_lost",
    }

    for alert in alerts:
        payload = alert.model_dump()
        assert required_fields.issubset(payload)
        assert payload["reasoning"]
        assert 12.96 <= payload["lat"] <= 12.99
        assert 77.58 <= payload["lng"] <= 77.61
        assert payload["total_kwh_lost"] > 0


def test_gap_stats_endpoint_returns_timeline_rows():
    _refresh_detection()

    stats = get_gap_stats("F001")

    assert len(stats) == 672
    assert {
        "timestamp",
        "feeder_kwh",
        "meters_sum_kwh",
        "gap_kwh",
        "gap_ratio",
    }.issubset(stats[0])
    assert stats[0]["timestamp"] == "2024-01-01 00:00:00"
    day_one_average_gap = sum(row["gap_ratio"] for row in stats[:96]) / 96
    assert 0.04 <= day_one_average_gap <= 0.07
    assert max(row["gap_ratio"] for row in stats[-96:]) > 0.1
