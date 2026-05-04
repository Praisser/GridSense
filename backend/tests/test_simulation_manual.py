from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_simulation():
    # 1. Reset
    resp = client.post("/api/simulate/reset")
    assert resp.status_code == 200

    # 2. Get alerts
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    initial_alerts = resp.json()

    # 3. Inject theft on M03 (assuming M03 is normal)
    payload = {"meter_id": "M03", "type": "bypass", "intensity": 0.8}
    resp = client.post("/api/simulate/theft", json=payload)
    assert resp.status_code == 200

    # 4. Get alerts again
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    after_alerts = resp.json()

    assert len(after_alerts) >= len(initial_alerts)
    m03_alert = next((a for a in after_alerts if a["meter_id"] == "M03"), None)
    assert m03_alert is not None
    assert m03_alert["loss_type"] == "bypass_theft"


if __name__ == "__main__":
    test_simulation()
