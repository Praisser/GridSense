import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Settings, Sun, Volume2, VolumeX, Zap } from "lucide-react";
import client from "./api/client";
import AlertFeed from "./components/AlertFeed";
import FeederMap from "./components/FeederMap";
import GapTimeline from "./components/GapTimeline";
import MeterDrawer from "./components/MeterDrawer";
import SimulationModal from "./components/SimulationModal";
import {
  DEFAULT_FEEDER_ID,
  DEFAULT_TIME_RANGE_DAYS,
  buildAlertIndex,
  getAlertDeltaIds,
  getDashboardRefreshInterval,
  getKnownAlertForMeter,
  normalizeAlerts,
} from "./utils/dashboardData";

const FEEDERS = [
  { id: "F001", label: "F001 — North Blr" },
  { id: "F002", label: "F002 — East Blr" },
  { id: "F003", label: "F003 — West Blr" },
];

function Toast({ toast }) {
  const borderColor =
    toast.type === "error" ? "var(--risk-critical)" : "var(--risk-low)";

  return (
    <div
      className="fixed top-4 right-4 z-[70] slide-in-top"
      style={{ width: "360px" }}
    >
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderLeft: `4px solid ${borderColor}`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div className="px-4 py-3">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {toast.message}
          </p>
        </div>
        <div
          className="h-0.5 toast-progress"
          style={{ background: borderColor }}
        />
      </div>
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .toast-progress {
          animation: toastProgress 5s linear forwards;
        }
      `}</style>
    </div>
  );
}

function App() {
  const [selectedFeeder, setSelectedFeeder] = useState(DEFAULT_FEEDER_ID);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [alertTimeReference, setAlertTimeReference] = useState(
    () => new Date(),
  );
  const [timeRange, setTimeRange] = useState({ days: DEFAULT_TIME_RANGE_DAYS });
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [highlightedMeterIds, setHighlightedMeterIds] = useState(
    () => new Set(),
  );
  const [highlightToken, setHighlightToken] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [theme, setTheme] = useState("dark");
  const settingsRef = useRef(null);
  const previousAlertsRef = useRef([]);

  const refreshInterval = getDashboardRefreshInterval(isDemoMode);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const highlightMeters = useCallback((meterIds) => {
    if (!meterIds?.length) return;
    setHighlightedMeterIds(new Set(meterIds));
    setHighlightToken((c) => c + 1);
  }, []);

  const refreshAlerts = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setAlertsLoading(true);
        const response = await client.get("/api/alerts?limit=50");
        const fetchedAt = new Date();
        const normalizedAlerts = normalizeAlerts(response.data);
        const latestAlertTime = Math.max(
          ...normalizedAlerts
            .map((a) => new Date(a.last_anomaly_at).getTime())
            .filter(Number.isFinite),
          0,
        );
        const isHistoricalDemoData =
          latestAlertTime > 0 &&
          fetchedAt.getTime() - latestAlertTime > 30 * 24 * 60 * 60 * 1000;
        const newAlertIds = getAlertDeltaIds(
          previousAlertsRef.current,
          normalizedAlerts,
        );
        setAlerts(normalizedAlerts);
        previousAlertsRef.current = normalizedAlerts;
        setAlertsError(null);
        setLastUpdated(fetchedAt);
        setAlertTimeReference(
          isHistoricalDemoData
            ? new Date(latestAlertTime + 2 * 60 * 60 * 1000)
            : fetchedAt,
        );
        highlightMeters(newAlertIds);
      } catch {
        setAlertsError("Couldn't reach the backend. Try again?");
      } finally {
        setAlertsLoading(false);
      }
    },
    [highlightMeters],
  );

  const handleSimulationSuccess = useCallback(
    (result) => {
      const message = typeof result === "string" ? result : result.message;
      const meterId = typeof result === "string" ? null : result.meterId;
      showToast(message);
      if (meterId) highlightMeters([meterId]);
      refreshAlerts();
    },
    [highlightMeters, refreshAlerts, showToast],
  );

  useEffect(() => {
    const t = window.setTimeout(() => refreshAlerts(), 0);
    const i = window.setInterval(() => refreshAlerts({ silent: true }), refreshInterval);
    return () => { window.clearTimeout(t); window.clearInterval(i); };
  }, [refreshAlerts, refreshInterval]);

  useEffect(() => {
    if (highlightedMeterIds.size === 0) return undefined;
    const t = window.setTimeout(() => setHighlightedMeterIds(new Set()), 5000);
    return () => window.clearTimeout(t);
  }, [highlightedMeterIds, highlightToken]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);

  const alertIndex = useMemo(() => buildAlertIndex(alerts), [alerts]);
  const selectedAlert = useMemo(
    () => getKnownAlertForMeter(selectedMeter, alertIndex),
    [selectedMeter, alertIndex],
  );

  const totalKwhLost = useMemo(
    () => alerts.reduce((sum, a) => sum + (a.total_kwh_lost ?? 0), 0),
    [alerts],
  );

  const openAlertCount = useMemo(
    () => alerts.filter((a) => (a.status ?? "open") === "open").length,
    [alerts],
  );

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  if (alertsLoading && !lastUpdated) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-full animate-pulse opacity-30"
            style={{ background: "var(--accent)", transform: "scale(2)" }}
          />
          <div
            className="relative p-4 rounded-xl"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <Zap className="w-10 h-10" style={{ color: "var(--accent)" }} />
          </div>
        </div>
        <h1
          className="text-3xl font-bold tracking-tight font-mono"
          style={{ color: "var(--text-primary)" }}
        >
          Grid<span style={{ color: "var(--accent)" }}>Sense</span>
        </h1>
        <p
          className="mt-3 text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          Synchronizing grid data…
        </p>
        <div className="mt-6 flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--accent)", animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <header
        className="h-14 flex items-center justify-between px-5 flex-shrink-0 z-20"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {/* Left: wordmark + live dot */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: "var(--risk-low)",
                boxShadow: "0 0 6px var(--risk-low)",
                animation: "statusPulse 2s ease-in-out infinite",
              }}
              aria-label="Monitoring active"
            />
            <h1
              className="text-base font-bold tracking-tight font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              Grid<span style={{ color: "var(--accent)" }}>Sense</span>
            </h1>
          </div>

          {/* Feeder selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="feeder-select"
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ color: "var(--text-tertiary)" }}
            >
              Feeder
            </label>
            <div
              className="relative flex items-center gap-2 px-3 py-1 rounded-full cursor-pointer"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
              }}
            >
              <select
                id="feeder-select"
                value={selectedFeeder}
                onChange={(e) => setSelectedFeeder(e.target.value)}
                className="appearance-none bg-transparent text-sm font-medium pr-1 outline-none cursor-pointer"
                style={{ color: "var(--text-primary)" }}
              >
                {FEEDERS.map((f) => (
                  <option
                    key={f.id}
                    value={f.id}
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    {f.label}
                  </option>
                ))}
              </select>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  opacity: 0.9,
                }}
              >
                20
              </span>
            </div>
          </div>
        </div>

        {/* Right: live metrics + controls */}
        <div className="flex items-center gap-4">
          <div
            className="hidden xl:flex items-center gap-4 text-xs font-mono"
            style={{ color: "var(--text-secondary)" }}
          >
            <span>
              <span style={{ color: "var(--text-tertiary)" }}>ALERTS </span>
              <span
                style={{
                  color: openAlertCount > 0 ? "var(--risk-critical)" : "var(--risk-low)",
                  fontWeight: 600,
                }}
              >
                {openAlertCount}
              </span>
            </span>
            <span>
              <span style={{ color: "var(--text-tertiary)" }}>LOSS </span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {totalKwhLost.toFixed(1)} kWh
              </span>
            </span>
            <span>
              <span style={{ color: "var(--text-tertiary)" }}>UPTIME </span>
              <span style={{ color: "var(--risk-low)", fontWeight: 600 }}>
                100%
              </span>
            </span>
            <span style={{ color: "var(--border-emphasis)" }}>|</span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {lastUpdatedLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsDemoMode(!isDemoMode)}
            title="Toggle demo mode"
            aria-label="Toggle demo mode"
            className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-all"
            style={{
              background: isDemoMode ? "var(--accent)" : "var(--bg-elevated)",
              color: isDemoMode ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            DEMO
          </button>

          <button
            type="button"
            onClick={() => setIsSimModalOpen(true)}
            title="Open theft simulation"
            aria-label="Open theft simulation"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-bold transition-all"
            style={{
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "0 0 12px rgba(193,68,14,0.35)",
            }}
          >
            <Zap className="w-4 h-4" />
            Simulate
          </button>

          <div ref={settingsRef} className="relative">
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setSettingsOpen((o) => !o)}
              className="p-1.5 rounded-md transition-colors"
              style={{
                color: settingsOpen ? "var(--text-primary)" : "var(--text-tertiary)",
                background: settingsOpen ? "var(--bg-elevated)" : "transparent",
              }}
            >
              <Settings className="w-4 h-4" />
            </button>

            {settingsOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-52 rounded-lg p-3 z-[1100] fade-in"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Settings
                </p>

                {/* Theme toggle */}
                <button
                  type="button"
                  onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                  className="w-full flex items-center justify-between py-1.5 rounded"
                >
                  <div className="flex items-center gap-2">
                    {theme === "dark"
                      ? <Moon className="w-3.5 h-3.5" style={{ color: "var(--info)" }} />
                      : <Sun  className="w-3.5 h-3.5" style={{ color: "var(--risk-moderate)" }} />
                    }
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Theme
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--bg-base)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {theme === "dark" ? "Dark" : "Light"}
                  </span>
                </button>

                {/* Sound toggle */}
                <button
                  type="button"
                  onClick={() => setSoundEnabled((s) => !s)}
                  className="w-full flex items-center justify-between py-1.5 transition-colors rounded"
                >
                  <div className="flex items-center gap-2">
                    {soundEnabled
                      ? <Volume2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                      : <VolumeX className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
                    }
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Sound alerts
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: soundEnabled ? "var(--accent)" : "var(--bg-base)",
                      color: soundEnabled ? "#fff" : "var(--text-tertiary)",
                    }}
                  >
                    {soundEnabled ? "On" : "Off"}
                  </span>
                </button>

                <div
                  className="mt-3 pt-3 flex items-center justify-between"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                    GridSense
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-disabled)" }}>
                    v0.1.0
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden relative">
        <AlertFeed
          alerts={alerts}
          loading={alertsLoading}
          error={alertsError}
          selectedMeterId={selectedMeter}
          onSelectMeter={setSelectedMeter}
          onRefreshAlerts={() => refreshAlerts()}
          relativeTimeReference={alertTimeReference}
          highlightedMeterIds={highlightedMeterIds}
          highlightToken={highlightToken}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <GapTimeline
            feederId={selectedFeeder}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            refreshMs={refreshInterval}
          />
          <FeederMap
            alerts={alerts}
            alertIndex={alertIndex}
            selectedMeterId={selectedMeter}
            onSelectMeter={setSelectedMeter}
            isDemoMode={isDemoMode}
            refreshMs={refreshInterval}
            theme={theme}
          />
        </div>

        <MeterDrawer
          meterId={selectedMeter}
          alert={selectedAlert}
          onClose={() => setSelectedMeter(null)}
          onAlertAction={() => refreshAlerts({ silent: true })}
        />

        <SimulationModal
          isOpen={isSimModalOpen}
          onClose={() => setIsSimModalOpen(false)}
          onSimulationSuccess={handleSimulationSuccess}
        />
      </main>

      {toast && <Toast key={toast.key} toast={toast} />}
    </div>
  );
}

export default App;
