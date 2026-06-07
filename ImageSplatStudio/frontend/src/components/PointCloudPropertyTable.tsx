import { useState } from "react";
import {
  editorConfigureGrid,
  editorConfigureView,
  editorDeleteBreakline,
  editorDeleteCoordPoint,
  editorDeleteMeasurement,
  editorDeleteRegion,
  editorRemoveFile,
  editorSetVisibility,
  editorToggleHiddenRegion,
  editorExportLasUrl,
  editorExportTxtUrl,
  type EditorProperties,
} from "../api/editor";
import { useI18n } from "../i18n/I18nProvider";
import { formatFileSize } from "../utils/pointcloud";
import { COLOR_MODES, colorModeLabelKey, type ColorMode } from "../utils/colorModes";
import { CRS_CATEGORIES, CRS_PRESETS } from "../utils/coordTransform";

type PropTab = "files" | "crs" | "grid" | "results";

interface PointCloudPropertyTableProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  gridCellSize: number;
  onGridCellSizeChange: (v: number) => void;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
  onStartGridRegion?: () => void;
  onCreateGrid?: () => void;
}

export function PointCloudPropertyTable({
  sessionId,
  properties,
  gridCellSize,
  onGridCellSizeChange,
  onUpdated,
  onRefreshPreview,
  onError,
  onStartGridRegion,
  onCreateGrid,
}: PointCloudPropertyTableProps) {
  const { tr } = useI18n();
  const [tab, setTab] = useState<PropTab>("files");

  if (!properties) {
    return (
      <div className="panel pc-property-panel tp-panel empty">
        <h3>{tr("pcPropertyTitle")}</h3>
        <p className="tp-muted">{tr("pcPropertyEmpty")}</p>
      </div>
    );
  }

  const applyView = async (opts: Parameters<typeof editorConfigureView>[1]) => {
    if (!sessionId) return;
    try {
      const props = await editorConfigureView(sessionId, opts);
      onUpdated(props);
      if (
        opts.basemap_enabled != null ||
        opts.basemap_mode != null ||
        opts.crs_epsg != null ||
        opts.show_axes != null ||
        opts.color_mode != null ||
        opts.show_grid_surface != null
      ) {
        onRefreshPreview();
      }
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const applyGrid = async (opts: Parameters<typeof editorConfigureGrid>[1]) => {
    if (!sessionId) return;
    try {
      const props = await editorConfigureGrid(sessionId, opts);
      onUpdated(props);
      onRefreshPreview();
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

  const removeFile = async (index: number) => {
    if (!sessionId) return;
    try {
      const props = await editorRemoveFile(sessionId, index);
      onUpdated(props);
      onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const toggleRegionVisibility = async (id: string) => {
    if (!sessionId) return;
    try {
      const props = await editorToggleHiddenRegion(sessionId, id);
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

  const removeCoordPoint = async (id: string) => {
    if (!sessionId) return;
    try {
      const props = await editorDeleteCoordPoint(sessionId, id);
      onUpdated(props);
      onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const wm = properties.norm_meta?.world_min;
  const wx = properties.norm_meta?.world_max;
  const gridRegion = properties.grid.region;

  const tabs: { id: PropTab; label: string }[] = [
    { id: "crs", label: tr("propTabCrs") },
    { id: "files", label: tr("propTabFiles") },
    { id: "grid", label: tr("propTabGrid") },
    { id: "results", label: tr("propTabResults") },
  ];

  const hasResults =
    properties.measurements.length > 0 ||
    properties.breaklines.length > 0 ||
    properties.hidden_regions.length > 0 ||
    (properties.coord_points?.length ?? 0) > 0 ||
    (properties.traces?.length ?? 0) > 0;

  const measurementLabel = (type: string) => {
    if (type === "distance") return tr("toolMeasureDistance");
    if (type === "area") return tr("toolMeasureArea");
    if (type === "angle") return tr("toolMeasureAngle");
    if (type === "cross_section") return tr("toolCrossSection");
    return type;
  };

  return (
    <div className="panel pc-property-panel tp-panel">
      <h3>{tr("pcPropertyTitle")}</h3>
      <div className="pc-property-summary tp-muted">
        {properties.total_points.toLocaleString()} {tr("pcPreviewPoints")}
        {properties.swap_xy ? ` · ${tr("pcMenuSwapXy")}` : ""}
      </div>

      <div className="pc-prop-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`pc-prop-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "crs" && (
        <div className="tp-prop-section">
          <h4>{tr("pcPropCrs")}</h4>
          <select
            className="tp-select"
            value={properties.crs?.epsg ?? 6668}
            onChange={(e) => void applyView({ crs_epsg: Number(e.target.value) })}
          >
            {CRS_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {CRS_PRESETS.filter((c) => c.category === cat).map((c) => (
                  <option key={c.epsg} value={c.epsg}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {wm && wx && (
            <p className="tp-bounds">
              X: {wm[0].toFixed(2)}…{wx[0].toFixed(2)} · Y: {wm[1].toFixed(2)}…{wx[1].toFixed(2)} · Z:{" "}
              {wm[2].toFixed(2)}…{wx[2].toFixed(2)}
            </p>
          )}
          <p className="tp-muted tp-texture-hint">{tr("pcTextureMappingHint")}</p>
          <label className="pc-grid-label">
            <input
              type="checkbox"
              checked={properties.view?.show_axes ?? true}
              onChange={(e) => void applyView({ show_axes: e.target.checked })}
            />
            {tr("pcAxesEnable")}
          </label>
          <h4>{tr("viewDisplayTitle")}</h4>
          <label className="pc-grid-label">
            {tr("colorModeLabel")}
            <select
              className="tp-select"
              value={(properties.view?.color_mode as ColorMode) ?? "rgb"}
              onChange={(e) => void applyView({ color_mode: e.target.value })}
            >
              {COLOR_MODES.map((m) => (
                <option key={m} value={m}>
                  {tr(colorModeLabelKey(m) as "colorModeRgb")}
                </option>
              ))}
            </select>
          </label>
          <label className="pc-grid-label">
            <input
              type="checkbox"
              checked={properties.view?.show_grid_surface ?? false}
              disabled={!properties.grid.has_data}
              onChange={(e) => void applyView({ show_grid_surface: e.target.checked })}
            />
            {tr("viewGridSurface")}
          </label>
        </div>
      )}

      {tab === "grid" && (
        <div className="tp-prop-section tp-grid-panel">
          <h4>{tr("gridPanelTitle")}</h4>
          <p className="tp-muted tp-grid-hint">{tr("gridPanelHint")}</p>
          <label className="pc-grid-size">
            {tr("pcGridCellSize")}
            <input
              type="number"
              min={0.01}
              step={0.05}
              value={gridCellSize}
              onChange={(e) => onGridCellSizeChange(Number(e.target.value))}
            />
            <span>m</span>
          </label>
          <div className="tp-grid-actions">
            <button type="button" className="pc-menu-btn" onClick={() => onStartGridRegion?.()}>
              {tr("gridSelectRegion")}
            </button>
            {gridRegion && (
              <button
                type="button"
                className="pc-menu-btn"
                onClick={() =>
                  void applyGrid({
                    enabled: properties.grid.enabled,
                    cell_size: gridCellSize,
                    clear_region: true,
                  })
                }
              >
                {tr("gridClearRegion")}
              </button>
            )}
          </div>
          {gridRegion && (
            <p className="tp-bounds">
              {tr("gridRegionActive")}: X {gridRegion.min[0].toFixed(2)}…{gridRegion.max[0].toFixed(2)} · Y{" "}
              {gridRegion.min[1].toFixed(2)}…{gridRegion.max[1].toFixed(2)}
            </p>
          )}
          <label className="pc-grid-label">
            <input
              type="checkbox"
              checked={properties.grid.enabled}
              onChange={(e) =>
                void applyGrid({ enabled: e.target.checked, cell_size: gridCellSize })
              }
            />
            {tr("gridShowLines")}
          </label>
          <p className="tp-muted">{tr("gridMethodIdw")}</p>
          <button
            type="button"
            className="pc-menu-btn pc-menu-btn-accent tp-grid-create"
            onClick={() => onCreateGrid?.()}
          >
            {tr("gridCreate")}
          </button>
          {properties.grid.has_data && properties.grid.data_size && (
            <p className="tp-muted">
              {tr("gridDataReady")}: {properties.grid.data_size[0]}×{properties.grid.data_size[1]}
            </p>
          )}
        </div>
      )}

      {tab === "files" && (
        <div className="pc-property-table-wrap">
          <table className="pc-property-table">
            <thead>
              <tr>
                <th>{tr("pcPropVisible")}</th>
                <th>{tr("pcPropName")}</th>
                <th>{tr("pcPropFormat")}</th>
                <th>{tr("pcPropPoints")}</th>
                <th>{tr("pcPropSize")}</th>
                <th>{tr("pcPropActions")}</th>
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
                  <td className="pc-prop-file-actions">
                    {sessionId && (
                      <>
                        <a
                          className="pc-prop-link"
                          href={editorExportLasUrl(sessionId, i)}
                          download
                          title={tr("exportLas")}
                        >
                          LAS
                        </a>
                        <a
                          className="pc-prop-link"
                          href={editorExportTxtUrl(sessionId, i)}
                          download
                          title={tr("exportTxt")}
                        >
                          TXT
                        </a>
                        {properties.files.length > 1 && (
                          <button
                            type="button"
                            className="pc-prop-del"
                            title={tr("pcPropRemoveFile")}
                            onClick={() => void removeFile(i)}
                          >
                            ×
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "results" && (
        <>
          {!hasResults && <p className="tp-muted">{tr("propTabResultsEmpty")}</p>}
          {properties.coord_points && properties.coord_points.length > 0 && (
            <div className="pc-property-section">
              <h4>{tr("toolCoordPoint")}</h4>
              <ul className="pc-prop-list">
                {properties.coord_points.map((cp) => (
                  <li key={cp.id}>
                    <span>
                      {cp.label || cp.id}: {cp.position.map((v) => v.toFixed(3)).join(", ")}
                    </span>
                    <button type="button" className="pc-prop-del" onClick={() => void removeCoordPoint(cp.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {properties.measurements.length > 0 && (
            <div className="pc-property-section">
              <h4>{tr("pcPropMeasurements")}</h4>
              <ul className="pc-prop-list">
                {properties.measurements.map((m) => (
                  <li key={m.id}>
                    <span>
                      {measurementLabel(m.type)}: {m.value.toFixed(4)} {m.unit}
                    </span>
                    <button type="button" className="pc-prop-del" onClick={() => void removeMeasurement(m.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {properties.traces && properties.traces.length > 0 && (
            <div className="pc-property-section">
              <h4>{tr("traceResultsTitle")}</h4>
              <ul className="pc-prop-list">
                {properties.traces.map((t) => (
                  <li key={t.id}>
                    <span>
                      {t.id} · {t.triangles} △
                    </span>
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
                    <label className="pc-prop-region-row">
                      <input
                        type="checkbox"
                        checked={r.hidden}
                        onChange={() => void toggleRegionVisibility(r.id)}
                      />
                      <span>
                        {r.id}
                        {r.type === "lasso"
                          ? ` · ${tr("toolLassoSelect")} (${(r.point_count ?? 0).toLocaleString()})`
                          : r.min && r.max
                            ? ` · X ${r.min[0].toFixed(1)}…${r.max[0].toFixed(1)}`
                            : ""}
                      </span>
                    </label>
                    <button type="button" className="pc-prop-del" onClick={() => void removeRegion(r.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
