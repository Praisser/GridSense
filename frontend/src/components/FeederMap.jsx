import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import client from "../api/client";
import { FALLBACK_METERS } from "../api/fallbackData";
import { Layers, MapPin } from "lucide-react";
import {
  ALERT_REFRESH_INTERVAL_MS,
  buildAlertIndex,
  getMeterRisk,
} from "../utils/dashboardData";

const CARTO_DARK_TILE  = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_LIGHT_TILE = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const HEAT_SCRIPT_ID = "leaflet-heat-plugin";
const HEAT_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js";
const DEFAULT_CENTER = [12.9716, 77.5946];

function createMeterIcon(color, isPulsing, isSelected) {
  const pulseRing = isPulsing
    ? `<div class="gs-marker-pulse-ring" style="--mc:${color}"></div>`
    : "";
  const selectedRing = isSelected
    ? `<div class="gs-marker-selected-ring" style="--mc:${color}"></div>`
    : "";

  return L.divIcon({
    html: `
      <div class="gs-marker-wrap" style="--mc:${color}">
        ${pulseRing}
        <div class="gs-marker-ring"></div>
        <div class="gs-marker-dot"></div>
        ${selectedRing}
      </div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    tooltipAnchor: [14, -14],
  });
}

function createSubstationIcon() {
  return L.divIcon({
    html: `
      <div class="gs-substation">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <polygon
            points="12,2 21,7 21,17 12,22 3,17 3,7"
            style="fill: var(--accent); fill-opacity: 0.85; stroke: var(--accent); stroke-width: 1.5;"
          />
          <text x="12" y="15" font-size="8" font-family="monospace" font-weight="bold"
            text-anchor="middle" fill="white">SUB</text>
        </svg>
      </div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    tooltipAnchor: [12, -12],
  });
}

/**
 * @param {{
 *   alerts?: Array<object>,
 *   alertIndex?: Map<string, object>,
 *   isDemoMode?: boolean,
 *   onSelectMeter?: (meterId: string) => void,
 *   refreshMs?: number,
 *   selectedMeterId?: string | null,
 * }} props
 */
const FeederMap = ({
  alerts = [],
  alertIndex,
  isDemoMode = false,
  onSelectMeter,
  refreshMs = ALERT_REFRESH_INTERVAL_MS,
  selectedMeterId,
  theme = "dark",
}) => {
  const [meters, setMeters] = useState(FALLBACK_METERS);
  const [mapError, setMapError] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  const alertsByMeter = useMemo(
    () => alertIndex ?? buildAlertIndex(alerts),
    [alertIndex, alerts],
  );
  const zoom = isDemoMode ? 15 : 14;

  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const res = await client.get("/api/meters");
        setMeters(res.data);
        setMapError(null);
      } catch {
        // Keep fallback meters already in state — don't show error
      }
    };
    const t = window.setTimeout(fetchMeters, 0);
    const i = window.setInterval(fetchMeters, refreshMs);
    return () => { window.clearTimeout(t); window.clearInterval(i); };
  }, [refreshMs]);

  const heatPoints = useMemo(
    () =>
      meters
        .map((m) => {
          const a = alertsByMeter.get(m.meter_id);
          return [m.lat, m.lng, a ? Math.max(0.35, a.confidence) : 0];
        })
        .filter((p) => p[2] > 0),
    [meters, alertsByMeter],
  );

  // Auto-collapse legend after 5s
  useEffect(() => {
    const t = window.setTimeout(() => setLegendOpen(false), 5000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Layer controls */}
      <div className="absolute top-3 left-3 z-[1000]">
        <div
          className="flex p-1 gap-1 rounded-lg"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
          }}
        >
          {[
            { id: false, icon: <MapPin className="w-3.5 h-3.5" />, label: "Markers" },
            { id: true,  icon: <Layers className="w-3.5 h-3.5" />,  label: "Heatmap" },
          ].map(({ id, icon, label }) => (
            <button
              key={String(id)}
              type="button"
              onClick={() => setShowHeatmap(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: showHeatmap === id ? "var(--accent)" : "transparent",
                color: showHeatmap === id ? "#fff" : "var(--text-secondary)",
              }}
              aria-label={`Show ${label}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {mapError && (
        <div
          className="absolute top-3 right-3 z-[1000] px-3 py-2 rounded-md text-xs font-medium"
          style={{
            background: "var(--bg-elevated)",
            borderLeft: "3px solid var(--risk-high)",
            color: "var(--text-secondary)",
          }}
        >
          {mapError}
        </div>
      )}

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={zoom}
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <MapViewport center={DEFAULT_CENTER} zoom={zoom} />
        <TileLayer
          attribution={CARTO_ATTRIBUTION}
          url={theme === "light" ? CARTO_LIGHT_TILE : CARTO_DARK_TILE}
          key={theme}
        />

        {/* Meter markers */}
        {meters.map((meter) => {
          const alert = alertsByMeter.get(meter.meter_id);
          const risk = getMeterRisk(meter.meter_id, alertsByMeter);
          const isSelected = selectedMeterId === meter.meter_id;
          const isPulsing = risk.color === "#FF4D4F"; // only critical

          return (
            <Marker
              key={meter.meter_id}
              position={[meter.lat, meter.lng]}
              icon={createMeterIcon(risk.color, isPulsing, isSelected)}
              eventHandlers={{ click: () => onSelectMeter(meter.meter_id) }}
            >
              <Tooltip direction="top" opacity={1}>
                <div style={{ color: "var(--text-primary)" }}>
                  <p className="font-bold font-mono text-xs">{meter.meter_id}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {risk.label}
                    {alert ? ` · ${(alert.confidence * 100).toFixed(0)}%` : ""}
                  </p>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Substation marker */}
        <Marker
          position={DEFAULT_CENTER}
          icon={createSubstationIcon()}
        >
          <Tooltip permanent direction="bottom" offset={[0, 12]}>
            <span
              className="text-[10px] font-bold uppercase tracking-wider font-mono"
              style={{ color: "var(--accent)" }}
            >
              Substation F001
            </span>
          </Tooltip>
        </Marker>

        {showHeatmap && <HeatLayer points={heatPoints} />}
      </MapContainer>

      {/* Legend */}
      <div
        className="absolute bottom-4 right-4 z-[1000] rounded-lg overflow-hidden transition-all cursor-pointer"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          width: legendOpen ? "140px" : "36px",
          transitionDuration: "200ms",
        }}
        onClick={() => setLegendOpen((o) => !o)}
        onMouseEnter={() => setLegendOpen(true)}
        title={legendOpen ? "Collapse legend" : "Expand legend"}
      >
        {legendOpen ? (
          <div className="p-3">
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              Risk Level
            </p>
            {[
              { color: "var(--risk-critical)", label: "Critical" },
              { color: "var(--risk-high)",     label: "High" },
              { color: "var(--risk-low)",      label: "Normal" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-9 flex items-center justify-center">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>≡</span>
          </div>
        )}
      </div>
    </div>
  );
};

const MapViewport = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom, { animate: true }); }, [center, map, zoom]);
  return null;
};

const HeatLayer = ({ points }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    const removeLayer = () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };

    const addLayer = () => {
      if (isCancelled || !L.heatLayer) return;
      removeLayer();
      layerRef.current = L.heatLayer(points, {
        radius: 28, blur: 18, maxZoom: 17, minOpacity: 0.25,
      }).addTo(map);
    };

    window.L = window.L ?? L;

    if (L.heatLayer) {
      addLayer();
    } else {
      let script = document.getElementById(HEAT_SCRIPT_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = HEAT_SCRIPT_ID;
        script.src = HEAT_SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", addLayer, { once: true });
      script.addEventListener("error", () => console.error("Failed to load heatmap plugin"), { once: true });
    }

    return () => { isCancelled = true; removeLayer(); };
  }, [map, points]);

  return null;
};

export default FeederMap;
