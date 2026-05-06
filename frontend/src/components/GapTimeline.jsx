import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Brush,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import client from "../api/client";
import { FALLBACK_GAP_STATS } from "../api/fallbackData";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import {
  ALERT_REFRESH_INTERVAL_MS,
  DEFAULT_TIME_RANGE_DAYS,
  prepareGapTimelineRows,
} from "../utils/dashboardData";
import { useElementSize } from "../hooks/useElementSize";

const INR_PER_KWH = 8;

const GapTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <p className="font-bold mb-2 font-mono" style={{ color: "var(--text-primary)" }}>
        {row.displayTime}
      </p>
      <div className="space-y-1">
        <p style={{ color: "var(--info)" }}>
          Feeder: <span className="font-mono font-bold">{row.feeder_kwh.toFixed(1)} kWh</span>
        </p>
        <p style={{ color: "var(--text-secondary)" }}>
          Meters: <span className="font-mono font-bold">{row.meters_sum_kwh.toFixed(1)} kWh</span>
        </p>
        <p className="font-bold" style={{ color: "var(--risk-critical)" }}>
          Gap: <span className="font-mono">{row.gap_kwh.toFixed(1)} kWh ({row.gapPercentLabel})</span>
        </p>
      </div>
    </div>
  );
};

/**
 * @param {{
 *   feederId: string,
 *   refreshMs?: number,
 *   timeRange?: { days: number, start?: string, end?: string },
 *   onTimeRangeChange?: (range: object) => void,
 * }} props
 */
const GapTimeline = ({
  feederId,
  refreshMs = ALERT_REFRESH_INTERVAL_MS,
  timeRange = { days: DEFAULT_TIME_RANGE_DAYS },
  onTimeRangeChange,
}) => {
  const [data, setData] = useState(() => prepareGapTimelineRows(FALLBACK_GAP_STATS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [brushKey, setBrushKey] = useState(0);
  const [chartRef, chartSize] = useElementSize();

  useEffect(() => {
    const fetchData = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const res = await client.get(`/api/feeder/${feederId}/gap_stats`);
        setData(prepareGapTimelineRows(res.data));
        setError(null);
      } catch {
        // Keep fallback data already in state
      } finally {
        setLoading(false);
      }
    };

    const t = window.setTimeout(() => fetchData(), 0);
    const i = window.setInterval(() => fetchData({ silent: true }), refreshMs);
    return () => { window.clearTimeout(t); window.clearInterval(i); };
  }, [feederId, refreshMs]);

  const handleBrushChange = (range) => {
    if (!range || !data[range.startIndex] || !data[range.endIndex]) return;
    onTimeRangeChange?.({
      days: timeRange.days,
      start: data[range.startIndex].timestamp,
      end: data[range.endIndex].timestamp,
    });
  };

  const handleResetZoom = () => {
    setBrushKey((c) => c + 1);
    onTimeRangeChange?.({ days: DEFAULT_TIME_RANGE_DAYS });
  };

  const totalGapKwh = useMemo(
    () => data.reduce((sum, row) => sum + (row.gap_kwh > 0 ? row.gap_kwh : 0), 0),
    [data],
  );
  const estimatedLossInr = (totalGapKwh * INR_PER_KWH).toFixed(0);

  if (loading && data.length === 0) {
    return (
      <div
        className="h-48 flex items-center justify-center animate-pulse"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="skeleton h-3 w-48 rounded" />
      </div>
    );
  }

  return (
    <section
      className="flex-shrink-0 transition-all"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header bar */}
      <div
        className="px-5 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-5">
          {/* Headline loss number */}
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-xl font-bold font-mono tabular-nums"
              style={{ color: "var(--risk-critical)" }}
            >
              ₹{Number(estimatedLossInr).toLocaleString("en-IN")}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              est. loss this period
            </span>
          </div>

          {/* Legend dots */}
          <div className="hidden 2xl:flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--info)" }} />
              <span style={{ color: "var(--text-tertiary)" }}>Feeder Input</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--text-secondary)" }} />
              <span style={{ color: "var(--text-tertiary)" }}>Meter Total</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                background: "rgba(255,77,79,0.12)",
                color: "var(--risk-critical)",
                border: "1px solid rgba(255,77,79,0.25)",
              }}
            >
              Gap &gt; 10%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetZoom}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title="Reset zoom"
            aria-label="Reset timeline zoom"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title={isCollapsed ? "Expand timeline" : "Collapse timeline"}
            aria-label={isCollapsed ? "Expand gap timeline" : "Collapse gap timeline"}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="h-44 px-4 py-3">
          {error ? (
            <div
              className="h-full rounded-lg flex items-center justify-center text-xs font-medium"
              style={{
                background: "var(--bg-elevated)",
                borderLeft: "3px solid var(--risk-high)",
                color: "var(--text-secondary)",
              }}
            >
              {error}
            </div>
          ) : data.length === 0 ? (
            <div
              className="h-full rounded-lg flex items-center justify-center text-xs"
              style={{ background: "var(--bg-elevated)", color: "var(--text-tertiary)" }}
            >
              No gap timeline data available.
            </div>
          ) : (
            <div ref={chartRef} className="h-full w-full min-h-0 min-w-0">
              {chartSize.width > 0 && chartSize.height > 0 && (
                <ComposedChart
                  width={chartSize.width}
                  height={chartSize.height}
                  data={data}
                  margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gapGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#FF4D4F" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF4D4F" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="feederGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4DABF7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4DABF7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="displayTime"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={40}
                    tick={{ fill: "var(--text-tertiary)" }}
                  />
                  <YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}`}
                    tick={{ fill: "var(--text-tertiary)" }}
                    width={36}
                  />
                  <Tooltip content={<GapTooltip />} cursor={{ stroke: "var(--border-emphasis)", strokeWidth: 1 }} />

                  {/* Gap shading */}
                  <Area
                    type="monotone"
                    dataKey="gapBand"
                    stroke="transparent"
                    fill="url(#gapGradient)"
                    fillOpacity={1}
                    connectNulls={false}
                    isAnimationActive={false}
                  />

                  {/* Feeder line */}
                  <Line
                    type="monotone"
                    dataKey="feeder_kwh"
                    stroke="#4DABF7"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: "#4DABF7" }}
                  />

                  {/* Meter sum line */}
                  <Line
                    type="monotone"
                    dataKey="meters_sum_kwh"
                    stroke="#9BA3AB"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: "#9BA3AB" }}
                  />

                  <Brush
                    key={brushKey}
                    dataKey="displayTime"
                    height={20}
                    stroke="var(--border-emphasis)"
                    fill="var(--bg-elevated)"
                    travellerWidth={6}
                    onChange={handleBrushChange}
                  />
                </ComposedChart>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default GapTimeline;
