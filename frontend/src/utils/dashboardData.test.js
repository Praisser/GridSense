import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAlertIndex,
  getAlertDeltaIds,
  getDashboardRefreshInterval,
  formatRelativeTime,
  getKnownAlertForMeter,
  getMeterRisk,
  normalizeAlerts,
  ALERT_REFRESH_INTERVAL_MS,
  DEMO_REFRESH_INTERVAL_MS,
  prepareGapTimelineRows,
} from "./dashboardData.js";

const alerts = [
  {
    meter_id: "M15",
    loss_type: "meter_tampering",
    confidence: 0.82,
    last_anomaly_at: "2024-01-06T12:00:00Z",
    total_kwh_lost: 12,
  },
  {
    meter_id: "M07",
    loss_type: "bypass_theft",
    confidence: 0.93,
    last_anomaly_at: "2024-01-06T13:00:00Z",
    total_kwh_lost: 48,
  },
  {
    meter_id: "M13",
    loss_type: "faulty_meter",
    confidence: 0.88,
    last_anomaly_at: "2024-01-06T10:00:00Z",
    total_kwh_lost: 32,
  },
];

test("normalizes alerts by descending priority and builds an O(1) lookup", () => {
  const sorted = normalizeAlerts(alerts);
  const index = buildAlertIndex(sorted);

  assert.deepEqual(
    sorted.map((alert) => alert.meter_id),
    ["M07", "M13", "M15"],
  );
  assert.equal(index.get("M13").loss_type, "faulty_meter");
});

test("formats last anomaly timestamps as relative field-officer labels", () => {
  assert.equal(
    formatRelativeTime(
      "2024-01-06T10:30:00Z",
      new Date("2024-01-06T12:45:00Z"),
    ),
    "2 hours ago",
  );
  assert.equal(
    formatRelativeTime(
      "2024-01-06T12:44:00Z",
      new Date("2024-01-06T12:45:00Z"),
    ),
    "1 minute ago",
  );
});

test("maps Day 3 risk colors so M07 and M13 are red while M15-M18 are amber", () => {
  assert.equal(getMeterRisk("M07", buildAlertIndex(alerts)).color, "#FF4D4F");
  assert.equal(getMeterRisk("M13", buildAlertIndex(alerts)).color, "#FF4D4F");
  assert.equal(getMeterRisk("M15", buildAlertIndex(alerts)).color, "#FF8C42");
  assert.equal(getMeterRisk("M01", buildAlertIndex(alerts)).color, "#52C41A");
});

test("prepares chart rows with a red gap band only when the gap crosses threshold", () => {
  const rows = prepareGapTimelineRows([
    {
      timestamp: "2024-01-03T00:00:00Z",
      feeder_kwh: 100,
      meters_sum_kwh: 95,
      gap_kwh: 5,
      gap_ratio: 0.05,
    },
    {
      timestamp: "2024-01-04T00:00:00Z",
      feeder_kwh: 100,
      meters_sum_kwh: 82,
      gap_kwh: 18,
      gap_ratio: 0.18,
    },
  ]);

  assert.equal(rows[0].gapBand, null);
  assert.deepEqual(rows[1].gapBand, [82, 100]);
  assert.equal(rows[1].gapPercentLabel, "18.0%");
});

test("returns demo refresh timing when demo mode is enabled", () => {
  assert.equal(getDashboardRefreshInterval(false), ALERT_REFRESH_INTERVAL_MS);
  assert.equal(getDashboardRefreshInterval(true), DEMO_REFRESH_INTERVAL_MS);
});

test("identifies newly arrived alert ids without flagging existing cards", () => {
  const previousAlerts = [{ meter_id: "M07" }, { meter_id: "M13" }];
  const nextAlerts = [
    { meter_id: "M03" },
    { meter_id: "M07" },
    { meter_id: "M13" },
  ];

  assert.deepEqual(getAlertDeltaIds(previousAlerts, nextAlerts), ["M03"]);
  assert.deepEqual(getAlertDeltaIds([], nextAlerts), []);
});

test("resolves known meter alerts without requiring a 404 lookup for normal meters", () => {
  const alert = { meter_id: "M07", loss_type: "bypass_theft" };
  const index = buildAlertIndex([alert]);

  assert.equal(getKnownAlertForMeter("M07", index), alert);
  assert.equal(getKnownAlertForMeter("M14", index), null);
  assert.equal(getKnownAlertForMeter(null, index), null);
});
