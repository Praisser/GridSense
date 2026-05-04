from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_simulation_flow():
    # 1. Reset to ensure clean state
    response = client.post("/api/simulate/reset")
    assert response.status_code == 200
    assert response.json()["status"] == "reset"

    # 2. Check initial alerts (assuming M03 is NOT an alert)
    response = client.get("/api/alerts")
    alerts = response.json()
    m03_initial = next((a for a in alerts if a["meter_id"] == "M03"), None)
    # It might be an alert if generator makes it one, but usually M03 is clean in our setup

    # 3. Inject bypass theft on M03
    payload = {"meter_id": "M03", "type": "bypass", "intensity": 0.9}
    response = client.post("/api/simulate/theft", json=payload)
    assert response.status_code == 200
    m03_alert = response.json()
    assert m03_alert["meter_id"] == "M03"
    assert "bypass" in m03_alert["loss_type"]
    assert m03_alert["confidence"] > 0.5

    # 4. Verify M03 is now in the alerts list
    response = client.get("/api/alerts")
    alerts = response.json()
    assert any(a["meter_id"] == "M03" for a in alerts)

    # 5. Reset again
    response = client.post("/api/simulate/reset")
    assert response.status_code == 200

    # 6. Verify M03 is no longer an alert (or at least the injection is gone)
    response = client.get("/api/alerts")
    alerts = response.json()
    # M03 should be back to its original state.
    # If it was clean before, it should be clean now.
    m03_final = next((a for a in alerts if a["meter_id"] == "M03"), None)
    if m03_initial is None:
        assert m03_final is None


def test_simulate_tampering():
    client.post("/api/simulate/reset")
    payload = {"meter_id": "M03", "type": "tampering", "intensity": 0.9}
    response = client.post("/api/simulate/theft", json=payload)
    assert response.status_code == 200
    assert "tampering" in response.json()["loss_type"]


def test_simulate_invalid_meter():
    payload = {"meter_id": "NON_EXISTENT", "type": "bypass", "intensity": 0.5}
    response = client.post("/api/simulate/theft", json=payload)
    assert response.status_code == 404


def test_simulation_validates_type_and_intensity():
    bad_type = client.post(
        "/api/simulate/theft",
        json={"meter_id": "M03", "type": "unknown", "intensity": 0.6},
    )
    assert bad_type.status_code == 422

    too_low = client.post(
        "/api/simulate/theft",
        json={"meter_id": "M03", "type": "bypass", "intensity": 0.1},
    )
    assert too_low.status_code == 422

    too_high = client.post(
        "/api/simulate/theft",
        json={"meter_id": "M03", "type": "bypass", "intensity": 1.0},
    )
    assert too_high.status_code == 422


def test_simulation_events_are_logged_for_repeatability():
    client.post("/api/simulate/reset")

    first = client.post(
        "/api/simulate/theft",
        json={"meter_id": "M03", "type": "bypass", "intensity": 0.6},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/simulate/theft",
        json={"meter_id": "M03", "type": "tampering", "intensity": 0.8},
    )
    assert second.status_code == 200
    assert second.json()["loss_type"] == "meter_tampering"

    reset = client.post("/api/simulate/reset")
    assert reset.status_code == 200

    events = client.get("/api/simulate/events").json()
    recent = events[-4:]
    assert [event["action"] for event in recent] == [
        "reset",
        "theft",
        "theft",
        "reset",
    ]
    assert recent[1]["meter_id"] == "M03"
    assert recent[1]["type"] == "bypass"
    assert recent[2]["type"] == "tampering"
