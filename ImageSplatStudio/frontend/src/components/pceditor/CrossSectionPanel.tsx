import { useI18n } from "../../i18n/I18nProvider";
import type { CrossSectionProfile } from "../../utils/editorTools";

interface CrossSectionPanelProps {
  profile: CrossSectionProfile | null;
  onClose?: () => void;
}

export function CrossSectionPanel({ profile, onClose }: CrossSectionPanelProps) {
  const { tr } = useI18n();
  if (!profile) return null;

  const w = 320;
  const h = 140;
  const pad = 28;
  const stations = profile.stations_m;
  const zMean = profile.z_mean.filter((z) => Number.isFinite(z));
  if (stations.length < 2 || zMean.length === 0) {
    return (
      <div className="pc-cross-section-panel">
        <header>
          <strong>{tr("crossSectionTitle")}</strong>
          {onClose && (
            <button type="button" onClick={onClose}>
              ×
            </button>
          )}
        </header>
        <p className="pc-cross-empty">{tr("crossSectionEmpty")}</p>
      </div>
    );
  }

  const zMin = Math.min(...zMean);
  const zMax = Math.max(...zMean);
  const zRange = Math.max(zMax - zMin, 0.01);
  const sMax = profile.length_m;

  const pts = profile.stations_m
    .map((s, i) => {
      const z = profile.z_mean[i];
      if (!Number.isFinite(z)) return null;
      const x = pad + (s / sMax) * (w - pad * 2);
      const y = h - pad - ((z - zMin) / zRange) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="pc-cross-section-panel">
      <header>
        <strong>{tr("crossSectionTitle")}</strong>
        <span>
          L={profile.length_m.toFixed(2)}m · W={profile.width_m.toFixed(2)}m
        </span>
        {onClose && (
          <button type="button" className="pc-cross-close" onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <svg viewBox={`0 0 ${w} ${h}`} className="pc-cross-chart" aria-label="Cross section profile">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#64748b" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#64748b" strokeWidth="1" />
        <text x={pad - 4} y={pad + 4} fontSize="9" fill="#64748b" textAnchor="end">
          {zMax.toFixed(2)}
        </text>
        <text x={pad - 4} y={h - pad} fontSize="9" fill="#64748b" textAnchor="end">
          {zMin.toFixed(2)}
        </text>
        <text x={pad} y={h - 6} fontSize="9" fill="#64748b">
          0
        </text>
        <text x={w - pad} y={h - 6} fontSize="9" fill="#64748b" textAnchor="end">
          {sMax.toFixed(1)}m
        </text>
        {pts && (
          <polyline
            points={pts}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="pc-cross-stats">
        <span>Z min: {Math.min(...profile.z_min.filter(Number.isFinite)).toFixed(3)} m</span>
        <span>Z max: {Math.max(...profile.z_max.filter(Number.isFinite)).toFixed(3)} m</span>
        <span>Z avg: {(zMean.reduce((a, b) => a + b, 0) / zMean.length).toFixed(3)} m</span>
      </div>
    </div>
  );
}
