import { useState, useEffect } from "react";
import { X, Zap, RotateCcw, Loader2 } from "lucide-react";
import client from "../api/client";

const THEFT_TYPES = [
  { id: "bypass",    label: "Bypass" },
  { id: "tampering", label: "Tampering" },
  { id: "faulty",    label: "Faulty" },
];

const FormField = ({ label, children }) => (
  <div className="flex flex-col gap-2">
    <label
      className="text-[11px] font-bold uppercase tracking-widest"
      style={{ color: "var(--text-tertiary)" }}
    >
      {label}
    </label>
    {children}
  </div>
);

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSimulationSuccess?: (result: { message: string, meterId?: string }) => void,
 * }} props
 */
export default function SimulationModal({ isOpen, onClose, onSimulationSuccess }) {
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState("M03");
  const [theftType, setTheftType] = useState("bypass");
  const [intensity, setIntensity] = useState(0.6);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    client.get("/api/meters")
      .then((r) => setMeters(r.data))
      .catch(() => {});
  }, [isOpen]);

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      await client.post("/api/simulate/theft", {
        meter_id: selectedMeter,
        type: theftType,
        intensity: parseFloat(intensity),
      });
      onSimulationSuccess({
        action: "theft",
        meterId: selectedMeter,
        message: `Theft injected on ${selectedMeter}. Watching for detection…`,
      });
      onClose();
    } catch {
      alert("Failed to run simulation");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await client.post("/api/simulate/reset");
      onSimulationSuccess({
        action: "reset",
        message: "Simulation reset. Data restored to original state.",
      });
      onClose();
    } catch {
      alert("Failed to reset simulation");
    } finally {
      setResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 fade-in"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-[480px] rounded-modal overflow-hidden zoom-in"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2.5">
            <Zap
              className="w-4 h-4"
              style={{ color: "var(--accent)" }}
            />
            <h2
              className="text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Simulate Loss Event
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close simulation modal"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 flex flex-col gap-6">
          <FormField label="Select Meter">
            <select
              value={selectedMeter}
              onChange={(e) => setSelectedMeter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md text-sm font-mono outline-none transition-all"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {meters.map((m) => (
                <option
                  key={m.meter_id}
                  value={m.meter_id}
                  style={{ background: "var(--bg-elevated)" }}
                >
                  {m.meter_id}
                </option>
              ))}
            </select>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              Normal meters recommended for a clearer demo.
            </p>
          </FormField>

          <FormField label="Theft Type">
            <div className="grid grid-cols-3 gap-2">
              {THEFT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheftType(t.id)}
                  className="py-2 px-3 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: theftType === t.id ? "var(--accent)" : "var(--bg-elevated)",
                    color: theftType === t.id ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${theftType === t.id ? "var(--accent)" : "var(--border-default)"}`,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label={`Intensity — ${(intensity * 100).toFixed(0)}%`}>
            <input
              type="range"
              min="0.3"
              max="0.9"
              step="0.1"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <div
              className="flex justify-between text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>Subtle</span>
              <span>Extreme</span>
            </div>
          </FormField>
        </div>

        {/* Actions */}
        <div
          className="px-6 py-4 flex flex-col gap-2.5"
          style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}
        >
          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={loading || resetting}
            className="w-full py-3 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "0 0 16px rgba(193,68,14,0.3)",
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Run Simulation
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading || resetting}
            className="w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
