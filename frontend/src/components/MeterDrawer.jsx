import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageSquare, X } from "lucide-react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import client from "../api/client";
import { buildMeterTrendRows, getLossMeta } from "../utils/dashboardData";
import { useElementSize } from "../hooks/useElementSize";

const MiniTooltip = ({ active, payload, formatter }) => {
  if (!active || !payload?.length) return null;
  const val = formatter ? formatter(payload[0].value) : payload[0].value;
  return (
    <div
      className="px-2 py-1.5 rounded text-[10px] font-mono"
      style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-default)",
        color: "var(--text-primary)",
      }}
    >
      {val}
    </div>
  );
};

const ConfidenceGauge = ({ confidence }) => {
  const cells = 10;
  const filled = Math.round(confidence * cells);
  const color =
    confidence > 0.8
      ? "var(--risk-critical)"
      : confidence > 0.6
        ? "var(--risk-high)"
        : "var(--risk-moderate)";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: cells }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-sm transition-colors"
            style={{
              background: i < filled ? color : "var(--bg-elevated)",
              opacity: i < filled ? 1 : 0.6,
            }}
          />
        ))}
      </div>
      <span
        className="text-xs font-bold font-mono tabular-nums w-9 text-right"
        style={{ color }}
      >
        {Math.round(confidence * 100)}%
      </span>
    </div>
  );
};

/**
 * @param {{
 *   meterId?: string | null,
 *   alert?: object | null,
 *   onClose: () => void,
 * }} props
 */
const MeterDrawer = ({ meterId, alert: selectedAlert, onClose, onAlertAction }) => {
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isOpen = Boolean(meterId);
  const alert = selectedAlert ?? null;

  useEffect(() => {
    if (!meterId) return undefined;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setActionMessage("");
        const [histRes, fcastRes] = await Promise.all([
          client.get(`/api/meters/${meterId}/history`),
          client.get(`/api/meters/${meterId}/forecast?horizons=48`),
        ]);
        setHistory(histRes.data);
        setForecast(fcastRes.data);
      } catch {
        setError("Could not load meter details.");
        setHistory([]);
        setForecast([]);
      } finally {
        setLoading(false);
      }
    };

    const t = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(t);
  }, [meterId, reloadKey]);

  const historyRows = useMemo(() => buildMeterTrendRows(history), [history]);

  const forecastRows = useMemo(() =>
    forecast.map((r) => ({
      ...r,
      kwh: Number(r.kwh),
      displayTime: new Date(r.timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
    })),
    [forecast],
  );

  const lossType = alert?.loss_type ?? "none";
  const meta = getLossMeta(lossType);

  const handleAction = async (actionType) => {
    if (!meterId || actionLoading) return;
    setActionLoading(actionType);
    try {
      await client.post(`/api/alerts/${meterId}/${actionType}`);
      const label = actionType === "inspect" ? "Marked for inspection" : "Dismissed as false positive";
      setActionMessage(`${label}.`);
      onAlertAction?.();
    } catch {
      setActionMessage("Action failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <aside
      aria-hidden={!isOpen}
      className="h-full flex-shrink-0 z-20 overflow-hidden"
      style={{
        width: isOpen ? "440px" : "0",
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "width 200ms var(--ease-out-expo), opacity 200ms var(--ease-out-expo), transform 200ms var(--ease-out-expo)",
        background: "var(--bg-surface)",
        borderLeft: isOpen ? "1px solid var(--border-subtle)" : "none",
      }}
    >
      {isOpen && (
        <div className="w-[440px] h-full flex flex-col">
          {/* Section 1 — Header */}
          <div
            className="px-6 py-4 flex items-start justify-between sticky top-0 z-10"
            style={{
              background: "var(--bg-surface)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className="text-[10px] uppercase font-bold tracking-widest"
                style={{ color: "var(--text-tertiary)" }}
              >
                Meter ID
              </span>
              <h2
                className="text-2xl font-bold font-mono tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {meterId}
              </h2>
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full self-start"
                style={{
                  color: meta.color,
                  background: `${meta.color}18`,
                  border: `1px solid ${meta.color}40`,
                }}
              >
                {meta.shortLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md mt-1 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="Close meter details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex flex-col gap-5">
                {[80, 120, 100, 140].map((h, i) => (
                  <div key={i} className="skeleton animate-pulse rounded-lg" style={{ height: h }} />
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--bg-elevated)", color: "var(--risk-critical)" }}
                >
                  ⚠
                </div>
                <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((c) => c + 1)}
                  className="mt-3 px-4 py-2 rounded-md text-sm font-bold"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="p-6 flex flex-col gap-6">
                {/* Section 2 — Risk Assessment */}
                <section>
                  <p
                    className="text-[10px] uppercase font-bold tracking-widest mb-3"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Risk Assessment
                  </p>
                  {alert && (
                    <ConfidenceGauge confidence={alert.confidence} />
                  )}
                  <p
                    className="text-xs leading-relaxed mt-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {alert
                      ? alert.reasoning
                      : "This meter is operating within normal expected parameters. No anomalies detected in the current analysis cycle."}
                  </p>
                  {alert && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { label: "LOSS",     value: `${alert.total_kwh_lost?.toFixed(1)} kWh` },
                        { label: "DURATION", value: "—" },
                        { label: "DETECTED", value: "—" },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="px-2 py-2 rounded-md"
                          style={{ background: "var(--bg-elevated)" }}
                        >
                          <p
                            className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {label}
                          </p>
                          <p
                            className="text-xs font-bold font-mono"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Section 3 — Consumption Pattern */}
                <section>
                  <p
                    className="text-[10px] uppercase font-bold tracking-widest mb-3"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Consumption Pattern
                  </p>
                  <MiniChart
                    rows={historyRows}
                    dataKey="kwh"
                    color="var(--info)"
                    emptyText="No consumption history available."
                    showArea
                  />
                </section>

                {/* Section 4 — Anomaly Score Trend */}
                <section>
                  <p
                    className="text-[10px] uppercase font-bold tracking-widest mb-3"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Anomaly Score Trend
                  </p>
                  <MiniChart
                    rows={historyRows}
                    dataKey="anomaly_score"
                    color="var(--risk-critical)"
                    domain={[0, 1]}
                    threshold={0.4}
                    emptyText="No anomaly score data available."
                    formatter={(v) => Number(v).toFixed(2)}
                    showArea
                  />
                </section>

                {/* Section 5 — Consumption Forecast */}
                <section>
                  <p
                    className="text-[10px] uppercase font-bold tracking-widest mb-3"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Consumption Forecast (next 12h)
                  </p>
                  <MiniChart
                    rows={forecastRows}
                    dataKey="kwh"
                    color="var(--risk-moderate)"
                    emptyText="Forecast unavailable."
                    showArea
                  />
                  <p className="text-[10px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                    Projected from historical daily pattern. Anomalies indicate active theft signals.
                  </p>
                </section>

                {/* Section 6 — Recommended Action */}
                <section>
                  <p
                    className="text-[10px] uppercase font-bold tracking-widest mb-3"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Recommended Action
                  </p>
                  <div
                    className="p-4 rounded-lg mb-4"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <p className="text-xs font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                      {lossType === "none" ? "No action required." : "Dispatch field officer for inspection"}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {meta.action}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleAction("inspect")}
                      disabled={!!actionLoading || selectedAlert?.status === "inspecting"}
                      className="w-full py-2.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {actionLoading === "inspect" ? "Marking…" : selectedAlert?.status === "inspecting" ? "Inspecting" : "Mark for Inspection"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction("dismiss")}
                      disabled={!!actionLoading || selectedAlert?.status === "dismissed"}
                      className="w-full py-2.5 rounded-md text-sm font-medium transition-all disabled:opacity-50"
                      style={{
                        background: "transparent",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {actionLoading === "dismiss" ? "Dismissing…" : selectedAlert?.status === "dismissed" ? "Dismissed" : "Dismiss as False Positive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionMessage("Notes feature coming soon.")}
                      className="w-full py-2 text-sm transition-colors flex items-center justify-center gap-1.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Add Notes
                    </button>

                    {actionMessage && (
                      <p
                        className="px-3 py-2 rounded-md text-xs font-medium text-center"
                        role="status"
                        style={{
                          background: "var(--bg-elevated)",
                          borderLeft: "3px solid var(--risk-low)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {actionMessage}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

const MiniChart = ({ rows, dataKey, color, domain, threshold, emptyText, formatter, showArea }) => {
  const [chartRef, chartSize] = useElementSize();

  return (
    <div
      ref={chartRef}
      className="h-24 w-full rounded-lg overflow-hidden"
      style={{ background: "var(--bg-elevated)" }}
    >
      {rows.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {emptyText}
        </div>
      ) : chartSize.width > 0 && chartSize.height > 0 ? (
        showArea ? (
          <AreaChart
            width={chartSize.width}
            height={chartSize.height}
            data={rows}
            margin={{ top: 6, right: 4, left: -32, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`miniGrad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="displayTime" hide />
            <YAxis domain={domain} hide />
            <Tooltip content={<MiniTooltip formatter={formatter} />} cursor={false} />
            {threshold !== undefined && (
              <ReferenceLine
                y={threshold}
                stroke="var(--risk-moderate)"
                strokeDasharray="4 3"
                strokeWidth={1}
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#miniGrad-${dataKey})`}
              dot={false}
              activeDot={{ r: 3, fill: color }}
            />
          </AreaChart>
        ) : (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={rows}
            margin={{ top: 6, right: 4, left: -32, bottom: 0 }}
          >
            <XAxis dataKey="displayTime" hide />
            <YAxis domain={domain} hide />
            <Tooltip content={<MiniTooltip formatter={formatter} />} cursor={false} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
          </LineChart>
        )
      ) : null}
    </div>
  );
};

export default MeterDrawer;
