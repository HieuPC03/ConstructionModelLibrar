import {
  editorConfigureGrid,
  editorConfigureView,
  editorDeleteBreakline,
  editorDeleteMeasurement,
  editorDeleteRegion,
  editorSetVisibility,
  type EditorProperties,
} from "../api/editor";
import { useI18n } from "../i18n/I18nProvider";
import { formatFileSize } from "../utils/pointcloud";
import { CRS_PRESETS } from "../utils/coordTransform";

interface PointCloudPropertyTableProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  gridCellSize: number;
  onGridCellSizeChange: (v: number) => void;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
}

export function PointCloudPropertyTable({
  sessionId,
  properties,
  gridCellSize,
  onGridCellSizeChange,
  onUpdated,
  onRefreshPreview,
  onError,
}: PointCloudPropertyTableProps) {
  const { tr } = useI18n();

  if (!properties) {
    return (
      <div className="panel pc-property-panel tp-panel empty">
        <h3>{tr("pcPropertyTitle")}</h3>
        <p className="muted">{tr("pcPropertyEmpty")}</p>
      </div>
    );
  }

  const applyView = async (opts: Parameters<typeof editorConfigureView>[1]) => {
    if (!sessionId) return;
    try {
      const props = await editorConfigureView(sessionId, opts);
      onUpdated(props);
      if (opts.basemap_enabled != null || opts.show_axes != null) onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const toggleVisible = async (index: number, visible: boolean) => {
    if (!sessionId) return;
    try {
      const props = await editorSetVisibility(sessionId, index, visible);
      onUpdated(props);
      onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const applyGrid = async (enabled: boolean) => {
    if (!sessionId) return;
    try {
      const props = await editorConfigureGrid(sessionId, enabled, gridCellSize);
      onUpdated(props);
      onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const removeRegion = async (id: string) => {
    if (!sessionId) return;
    try {
      const props = await editorDeleteRegion(sessionId, id);
      onUpdated(props);
      onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const removeBreakline = async (id: string) => {
    if (!sessionId) return;
    try {
      const props = await editorDeleteBreakline(sessionId, id);
      onUpdated(props);
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const removeMeasurement = async (id: string) => {
    if (!sessionId) return;
    try {
      const props = await editorDeleteMeasurement(sessionId, id);
      onUpdated(props);
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const wm = properties.norm_meta?.world_min;
  const wx = properties.norm_meta?.world_max;

  return (
    <div className="panel pc-property-panel tp-panel">
      <h3>{tr("pcPropertyTitle")}</h3>
      <div className="pc-property-summary muted">
        {properties.total_points.toLocaleString()} {tr("pcPreviewPoints")}
        {properties.swap_xy ? ` · ${tr("pcMenuSwapXy")}` : ""}
      </div>

      <div className="tp-prop-section">
        <h4>{tr("pcPropCrs")}</h4>
        <select
          className="tp-select"
          value={properties.crs?.epsg ?? 6668}
          onChange={(e) => void applyView({ crs_epsg: Number(e.target.value) })}
        >
          {CRS_PRESETS.map((c) => (
            <option key={c.epsg} value={c.epsg}>
              {c.name}
            </option>
          ))}
        </select>
        {wm && wx && (
          <p className="tp-bounds muted">
            X: {wm[0].toFixed(2)}…{wx[0].toFixed(2)} · Y: {wm[1].toFixed(2)}…{wx[1].toFixed(2)} · Z:{" "}
            {wm[2].toFixed(2)}…{wx[2].toFixed(2)}
          </p>
        )}
        <label className="pc-grid-label">
          <input
            type="checkbox"
            checked={properties.basemap?.enabled ?? false}
            onChange={(e) => void applyView({ basemap_enabled: e.target.checked })}
          />
          {tr("pcBasemapEnable")}
        </label>
        <label className="pc-grid-label">
          <input
            type="checkbox"
            checked={properties.view?.show_axes ?? true}
            onChange={(e) => void applyView({ show_axes: e.target.checked })}
          />
          {tr("pcAxesEnable")}
        </label>
      </div>

      <div className="pc-property-grid-controls">
        <label className="pc-grid-label">
          <input
            type="checkbox"
            checked={properties.grid.enabled}
            onChange={(e) => void applyGrid(e.target.checked)}
          />
          {tr("pcGridEnable")}
        </label>
        <label className="pc-grid-size">
          {tr("pcGridCellSize")}
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={gridCellSize}
            onChange={(e) => onGridCellSizeChange(Number(e.target.value))}
            onBlur={() => {
              if (properties.grid.enabled) void applyGrid(true);
            }}
          />
          <span>m</span>
        </label>
      </div>

      <div className="pc-property-table-wrap">
        <table className="pc-property-table">
          <thead>
            <tr>
              <th>{tr("pcPropVisible")}</th>
              <th>{tr("pcPropName")}</th>
              <th>{tr("pcPropFormat")}</th>
              <th>{tr("pcPropPoints")}</th>
              <th>{tr("pcPropSize")}</th>
            </tr>
          </thead>
          <tbody>
            {properties.files.map((f, i) => (
              <tr key={`${f.name}-${i}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={f.visible}
                    onChange={(e) => void toggleVisible(i, e.target.checked)}
                  />
                </td>
                <td title={f.name}>{f.name}</td>
                <td>{f.format.toUpperCase()}</td>
                <td>{f.point_count.toLocaleString()}</td>
                <td>{f.size_bytes > 0 ? formatFileSize(f.size_bytes) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {properties.measurements.length > 0 && (
        <div className="pc-property-section">
          <h4>{tr("pcPropMeasurements")}</h4>
          <ul className="pc-prop-list">
            {properties.measurements.map((m) => (
              <li key={m.id}>
                <span>
                  {m.type === "distance" ? tr("toolMeasureDistance") : tr("toolMeasureArea")}:{" "}
                  {m.value.toFixed(4)} {m.unit}
                </span>
                <button type="button" className="pc-prop-del" onClick={() => void removeMeasurement(m.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {properties.breaklines.length > 0 && (
        <div className="pc-property-section">
          <h4>{tr("pcPropBreaklines")}</h4>
          <ul className="pc-prop-list">
            {properties.breaklines.map((bl) => (
              <li key={bl.id}>
                <span>
                  {bl.id} · {bl.points.length} {tr("pcPropVertices")}
                </span>
                <button type="button" className="pc-prop-del" onClick={() => void removeBreakline(bl.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {properties.hidden_regions.length > 0 && (
        <div className="pc-property-section">
          <h4>{tr("pcHiddenRegions")}</h4>
          <ul className="pc-prop-list">
            {properties.hidden_regions.map((r) => (
              <li key={r.id}>
                <span>{r.id}</span>
                <button type="button" className="pc-prop-del" onClick={() => void removeRegion(r.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
