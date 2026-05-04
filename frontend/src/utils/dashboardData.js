export const DEFAULT_FEEDER_ID = "F001";
export const DEFAULT_TIME_RANGE_DAYS = 7;
export const ALERT_REFRESH_INTERVAL_MS = 30_000;
export const DEMO_REFRESH_INTERVAL_MS = 3_000;
export const GAP_ALERT_THRESHOLD = 0.1;

const LOSS_TYPE_PRIORITY = {
  bypass_theft: 4,
  faulty_meter: 3,
  meter_tampering: 2,
  other_anomaly: 1,
  none: 0,
};

export const LOSS_TYPE_META = {
  bypass_theft: {
    label: "Bypass Theft",
    shortLabel: "Bypass",
    color: "#FF4D4F",
    action: "Immediate physical inspection of meter and service line.",
  },
  meter_tampering: {
    label: "Meter Tampering",
    shortLabel: "Tampering",
    color: "#FF8C42",
    action: "Verify meter seal integrity and check for magnetic interference.",
  },
  faulty_meter: {
    label: "Faulty Meter",
    shortLabel: "Faulty",
    color: "#FFC53D",
    action: "Replace meter at the earliest field visit.",
  },
  other_anomaly: {
    label: "Billing Error",
    shortLabel: "Billing",
    color: "#4DABF7",
    action: "Verify reading logs and billing software synchronization.",
  },
  none: {
    label: "Normal Operation",
    shortLabel: "Normal",
    color: "#52C41A",
    action: "No action required. Monitoring continues.",
  },
};

export const RISK_META = {
  high: {
    label: "High risk",
    color: "#FF4D4F",
  },
  suspicious: {
    label: "Suspicious",
    color: "#FF8C42",
  },
  safe: {
    label: "Safe",
    color: "#52C41A",
  },
};

export function normalizeAlerts(alerts = []) {
  return [...alerts].sort((a, b) => {
    const priorityDelta =
      getLossPriority(b.loss_type) - getLossPriority(a.loss_type);
    if (priorityDelta !== 0) return priorityDelta;

    const scoreDelta =
      Number(b.composite_score ?? 0) - Number(a.composite_score ?? 0);
    if (scoreDelta !== 0) return scoreDelta;

    const confidenceDelta =
      Number(b.confidence ?? 0) - Number(a.confidence ?? 0);
    if (confidenceDelta !== 0) return confidenceDelta;

    return Number(b.total_kwh_lost ?? 0) - Number(a.total_kwh_lost ?? 0);
  });
}

export function buildAlertIndex(alerts = []) {
  return new Map(alerts.map((alert) => [alert.meter_id, alert]));
}

export function getKnownAlertForMeter(meterId, alertIndex) {
  if (!meterId || !alertIndex) return null;
  return alertIndex.get(meterId) ?? null;
}

export function getDashboardRefreshInterval(isDemoMode) {
  return isDemoMode ? DEMO_REFRESH_INTERVAL_MS : ALERT_REFRESH_INTERVAL_MS;
}

export function getAlertDeltaIds(previousAlerts = [], nextAlerts = []) {
  if (previousAlerts.length === 0) return [];

  const previousIds = new Set(previousAlerts.map((alert) => alert.meter_id));
  return nextAlerts
    .filter((alert) => !previousIds.has(alert.meter_id))
    .map((alert) => alert.meter_id);
}

export function getLossMeta(lossType) {
  return LOSS_TYPE_META[lossType] ?? LOSS_TYPE_META.other_anomaly;
}

export function getMeterRisk(meterId, alertIndex) {
  const alert = alertIndex?.get(meterId);
  if (!alert) return RISK_META.safe;

  if (
    alert.loss_type === "bypass_theft" ||
    alert.loss_type === "faulty_meter"
  ) {
    return RISK_META.high;
  }

  return RISK_META.suspicious;
}

export function getMeterMarkerRadius(meter, alert, isSelected = false) {
  const consumptionSignal = Number(
    meter?.total_kwh ?? alert?.total_kwh_lost ?? 0,
  );
  const scaledRadius = 7 + Math.min(8, Math.max(0, consumptionSignal / 10));
  return isSelected ? scaledRadius + 3 : scaledRadius;
}

export function formatRelativeTime(value, now = new Date()) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Unknown";

  const diffMs = Math.max(0, now.getTime() - timestamp.getTime());
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}

export function prepareGapTimelineRows(
  rows = [],
  threshold = GAP_ALERT_THRESHOLD,
) {
  return rows.map((row) => {
    const gapRatio = Number(row.gap_ratio ?? 0);
    const feederKwh = Number(row.feeder_kwh ?? 0);
    const metersSumKwh = Number(row.meters_sum_kwh ?? 0);

    return {
      ...row,
      feeder_kwh: feederKwh,
      meters_sum_kwh: metersSumKwh,
      gap_kwh: Number(row.gap_kwh ?? feederKwh - metersSumKwh),
      gap_ratio: gapRatio,
      gapBand: gapRatio > threshold ? [metersSumKwh, feederKwh] : null,
      gapPercentLabel: `${(gapRatio * 100).toFixed(1)}%`,
      displayTime: new Date(row.timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
    };
  });
}

export function buildMeterTrendRows(history = []) {
  if (history.length === 0) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
  const baselineWindow = sorted.slice(0, Math.min(sorted.length, 96 * 3));
  const baseline =
    baselineWindow.reduce(
      (total, reading) => total + Number(reading.kwh ?? 0),
      0,
    ) / Math.max(1, baselineWindow.length);

  return sorted.map((reading) => {
    const kwh = Number(reading.kwh ?? 0);
    const anomalyScore =
      baseline > 0 ? Math.min(1, Math.abs(kwh - baseline) / baseline) : 0;

    return {
      ...reading,
      kwh,
      anomaly_score: Number(anomalyScore.toFixed(3)),
      displayTime: new Date(reading.timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
    };
  });
}

function getLossPriority(lossType) {
  return LOSS_TYPE_PRIORITY[lossType] ?? LOSS_TYPE_PRIORITY.other_anomaly;
}
