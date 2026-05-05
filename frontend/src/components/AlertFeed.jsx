import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { formatRelativeTime, getLossMeta } from "../utils/dashboardData";

const STATUS_FILTERS = [
  { id: "open",       label: "Open" },
  { id: "critical",   label: "Critical" },
  { id: "inspecting", label: "Inspecting" },
  { id: "dismissed",  label: "Dismissed" },
];

function getAlertStatus(alert) {
  return alert.status ?? "open";
}

function matchesFilter(alert, filterId) {
  const status = getAlertStatus(alert);
  if (filterId === "open")       return status === "open";
  if (filterId === "critical")   return status === "open" && alert.loss_type === "bypass_theft";
  if (filterId === "inspecting") return status === "inspecting";
  if (filterId === "dismissed")  return status === "dismissed";
  return true;
}

function getFilterCount(alerts, filterId) {
  return alerts.filter((a) => matchesFilter(a, filterId)).length;
}

const EMPTY_HIGHLIGHTED_METERS = new Set();

const AlertCard = forwardRef(function AlertCard(
  { alert, isHighlighted, isSelected, onClick, relativeTimeReference },
  ref,
) {
  const meta = getLossMeta(alert.loss_type);
  const confidence = Math.round(alert.confidence * 100);
  const status = alert.status ?? "open";
  const statusLabel = status === "inspecting" ? "Inspecting" : status === "dismissed" ? "Dismissed" : null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onClick(alert.meter_id)}
      aria-pressed={isSelected}
      className={`w-full text-left rounded-lg transition-all focus-visible:outline-none ${isHighlighted ? "alert-card-new" : ""}`}
      style={{
        background: isSelected ? "var(--bg-elevated)" : "var(--bg-surface)",
        borderTop: `1px solid ${isSelected ? meta.color + "55" : "var(--border-subtle)"}`,
        borderRight: `1px solid ${isSelected ? meta.color + "55" : "var(--border-subtle)"}`,
        borderBottom: `1px solid ${isSelected ? meta.color + "55" : "var(--border-subtle)"}`,
        borderLeft: `${isSelected || isHighlighted ? "4px" : "3px"} solid ${meta.color}`,
        boxShadow: isSelected ? `0 0 0 1px ${meta.color}33` : "none",
        opacity: status === "dismissed" ? 0.65 : 1,
        transitionDuration: "120ms",
      }}
    >
        <div className="px-4 pt-4 pb-5">
          {/* Row 1: meter ID + badges */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <span
              className="text-sm font-bold font-mono tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              {alert.meter_id}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {statusLabel && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: status === "inspecting" ? "var(--info)" : "var(--text-tertiary)",
                    background: status === "inspecting" ? "rgba(77,171,247,0.12)" : "var(--bg-elevated)",
                    border: `1px solid ${status === "inspecting" ? "rgba(77,171,247,0.3)" : "var(--border-default)"}`,
                  }}
                >
                  {statusLabel}
                </span>
              )}
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  color: meta.color,
                  background: `${meta.color}18`,
                  border: `1px solid ${meta.color}40`,
                }}
              >
                {meta.shortLabel}
              </span>
            </div>
          </div>

          {/* Row 2: confidence bar */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ background: "var(--bg-elevated)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${confidence}%`,
                  background: meta.color,
                  opacity: 0.85,
                }}
              />
            </div>
            <span
              className="text-[11px] font-bold font-mono tabular-nums w-8 text-right"
              style={{ color: meta.color }}
            >
              {confidence}%
            </span>
          </div>

          {/* Row 3: stats — 2-column grid so both sides have label + value */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p
                className="text-[10px] uppercase font-medium tracking-wider mb-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                Lost
              </p>
              <p
                className="text-xs font-bold font-mono"
                style={{ color: "var(--text-primary)" }}
              >
                {alert.total_kwh_lost.toFixed(1)} kWh
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-[10px] uppercase font-medium tracking-wider mb-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                Detected
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatRelativeTime(alert.last_anomaly_at, relativeTimeReference)}
              </p>
            </div>
          </div>
        </div>
    </button>
  );
});

const AlertSkeleton = () => (
  <div
    className="rounded-lg p-4 animate-pulse"
    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
  >
    <div className="flex justify-between mb-3">
      <div className="skeleton h-4 w-16 rounded" />
      <div className="skeleton h-4 w-14 rounded-full" />
    </div>
    <div className="skeleton h-1 w-full rounded-full mb-3" />
    <div className="flex justify-between">
      <div className="skeleton h-3 w-16 rounded" />
      <div className="skeleton h-3 w-14 rounded" />
    </div>
  </div>
);

/**
 * @param {{
 *   alerts: Array<object>,
 *   loading?: boolean,
 *   error?: string | null,
 *   highlightedMeterIds?: Set<string>,
 *   onRefreshAlerts?: () => void,
 *   onSelectMeter?: (meterId: string) => void,
 *   relativeTimeReference?: Date,
 *   selectedMeterId?: string | null,
 * }} props
 */
const AlertFeed = ({
  alerts = [],
  loading = false,
  error = null,
  highlightedMeterIds = EMPTY_HIGHLIGHTED_METERS,
  highlightToken = 0,
  onRefreshAlerts,
  onSelectMeter,
  relativeTimeReference,
  selectedMeterId,
}) => {
  const [activeFilter, setActiveFilter] = useState("open");
  const cardRefs = useRef(new Map());

  const filteredAlerts = useMemo(
    () => alerts.filter((a) => matchesFilter(a, activeFilter)),
    [alerts, activeFilter],
  );

  const highlightedMeterKey = [...highlightedMeterIds].join("|");

  useEffect(() => {
    const targetMeterId = highlightedMeterKey
      ? highlightedMeterKey.split("|")[0]
      : selectedMeterId;
    const targetCard = cardRefs.current.get(targetMeterId);
    if (targetCard) targetCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedMeterId, filteredAlerts, highlightedMeterKey]);

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 overflow-hidden w-[340px]"
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3 flex flex-col gap-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2
              className="text-sm font-bold tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              Active Alerts
            </h2>
            {(() => {
              const openCount = getFilterCount(alerts, "open");
              return (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono"
                  style={{
                    background: openCount > 0 ? "var(--risk-critical)" : "var(--bg-elevated)",
                    color: openCount > 0 ? "#fff" : "var(--text-tertiary)",
                  }}
                >
                  {openCount}
                </span>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={onRefreshAlerts}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title="Refresh alerts"
            aria-label="Refresh alerts"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = getFilterCount(alerts, f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
                style={{
                  background: activeFilter === f.id ? "var(--accent)" : "var(--bg-elevated)",
                  color: activeFilter === f.id ? "#fff" : "var(--text-secondary)",
                  border: "1px solid transparent",
                }}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1 rounded-full min-w-[14px] text-center"
                    style={{
                      background: activeFilter === f.id ? "rgba(255,255,255,0.25)" : "var(--bg-base)",
                      color: activeFilter === f.id ? "#fff" : "var(--text-tertiary)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error banner (non-blocking) */}
      {error && alerts.length > 0 && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-md text-xs font-medium"
          role="status"
          style={{
            background: "var(--bg-elevated)",
            borderLeft: "3px solid var(--risk-high)",
            color: "var(--text-secondary)",
          }}
        >
          {error}
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {loading && alerts.length === 0 ? (
          [1, 2, 3, 4, 5].map((i) => <AlertSkeleton key={i} />)
        ) : error && alerts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center px-6"
            role="alert"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-4 text-lg"
              style={{ background: "var(--bg-elevated)", color: "var(--risk-critical)" }}
            >
              ⚠
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Could not load alerts.
            </p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Check that the backend is running, then retry.
            </p>
            <button
              type="button"
              onClick={onRefreshAlerts}
              className="px-4 py-2 rounded-md text-sm font-bold transition-colors"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Retry?
            </button>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            {/* Simple all-green sparkline SVG */}
            <svg width="80" height="32" viewBox="0 0 80 32" fill="none" className="mb-4 opacity-60">
              <polyline
                points="0,24 13,20 26,22 39,16 52,18 65,12 80,14"
                stroke="var(--risk-low)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {[0,13,26,39,52,65,80].map((x, i) => {
                const ys = [24,20,22,16,18,12,14];
                return (
                  <circle key={i} cx={x} cy={ys[i]} r="2.5" fill="var(--risk-low)" />
                );
              })}
            </svg>
            <p className="font-semibold text-sm mb-1.5" style={{ color: "var(--text-primary)" }}>
              System Baseline Secure
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              All clear. Grid is operating normally.
            </p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              No matching alerts
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              Try a different filter.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isHighlighted = highlightedMeterIds.has(alert.meter_id);
            return (
              <AlertCard
                key={isHighlighted ? `${alert.meter_id}-${highlightToken}` : alert.meter_id}
                ref={(node) => {
                  if (node) cardRefs.current.set(alert.meter_id, node);
                  else cardRefs.current.delete(alert.meter_id);
                }}
                alert={alert}
                isHighlighted={isHighlighted}
                isSelected={selectedMeterId === alert.meter_id}
                onClick={onSelectMeter}
                relativeTimeReference={relativeTimeReference}
              />
            );
          })
        )}
      </div>
    </aside>
  );
};

export default AlertFeed;
