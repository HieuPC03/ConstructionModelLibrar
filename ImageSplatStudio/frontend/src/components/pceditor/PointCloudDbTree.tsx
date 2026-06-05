import { useI18n } from "../../i18n/I18nProvider";
import {
  editorClearRegions,
  editorDeleteBreakline,
  editorDeleteMeasurement,
  editorDeleteRegion,
  editorSetVisibility,
  editorShowAll,
  type EditorProperties,
} from "../../api/editor";
import { formatFileSize } from "../../utils/pointcloud";
import { logConsole } from "../../utils/consoleLog";

interface PointCloudDbTreeProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
  onSelectLayer?: (id: string) => void;
}

export function PointCloudDbTree({
  sessionId,
  properties,
  onUpdated,
  onRefreshPreview,
  onError,
  onSelectLayer,
}: PointCloudDbTreeProps) {
  const { tr } = useI18n();

  const run = async (label: string, fn: () => Promise<EditorProperties>) => {
    if (!sessionId) return;
    try {
      const props = await fn();
      onUpdated(props);
      onRefreshPreview();
      logConsole(label, "success");
    } catch (e: unknown) {
      onError(String(e));
      logConsole(`${label}: ${String(e)}`, "error");
    }
  };

  if (!properties) {
    return (
      <div className="pc-db-tree">
        <h3 className="pc-panel-title">{tr("dbTreeTitle")}</h3>
        <p className="pc-db-empty">{tr("pcPropertyEmpty")}</p>
      </div>
    );
  }

  const grid = properties.grid;
  const mesh = properties.mesh;

  return (
    <div className="pc-db-tree">
      <h3 className="pc-panel-title">{tr("dbTreeTitle")}</h3>

      <details open className="pc-db-group">
        <summary>{tr("dbTreePointClouds")}</summary>
        <ul className="pc-db-list">
          {properties.files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="pc-db-item">
              <label className="pc-db-check">
                <input
                  type="checkbox"
                  checked={f.visible}
                  onChange={(e) =>
                    void run(tr("dbTreeVisibility"), () =>
                      editorSetVisibility(sessionId!, i, e.target.checked),
                    )
                  }
                />
                <span className="pc-db-name" title={f.name}>
                  {f.name}
                </span>
              </label>
              <span className="pc-db-meta">
                {f.point_count.toLocaleString()} · {f.format}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="pc-db-action"
          disabled={!sessionId}
          onClick={() => void run(tr("pcMenuShowAll"), () => editorShowAll(sessionId!))}
        >
          {tr("pcMenuShowAll")}
        </button>
      </details>

      <details open className="pc-db-group">
        <summary>{tr("dbTreeAnnotations")}</summary>
        <ul className="pc-db-list">
          {properties.hidden_regions.map((r) => (
            <li key={r.id} className="pc-db-item">
              <button
                type="button"
                className="pc-db-link"
                onClick={() => onSelectLayer?.(`region-${r.id}`)}
              >
                {tr("dbTreeHiddenRegion")} #{r.id}
              </button>
              <button
                type="button"
                className="pc-db-del"
                onClick={() =>
                  void run(tr("dbTreeDeleteRegion"), () => editorDeleteRegion(sessionId!, r.id))
                }
              >
                ×
              </button>
            </li>
          ))}
          {properties.breaklines.map((bl) => (
            <li key={bl.id} className="pc-db-item">
              <span className="pc-db-name">
                {tr("pcPropBreaklines")} ({bl.points.length} pts)
              </span>
              <button
                type="button"
                className="pc-db-del"
                onClick={() =>
                  void run(tr("dbTreeDeleteBreakline"), () => editorDeleteBreakline(sessionId!, bl.id))
                }
              >
                ×
              </button>
            </li>
          ))}
          {properties.measurements.map((m) => (
            <li key={m.id} className="pc-db-item">
              <span className="pc-db-name">
                {m.type}: {m.value.toFixed(3)} {m.unit}
              </span>
              <button
                type="button"
                className="pc-db-del"
                onClick={() =>
                  void run(tr("dbTreeDeleteMeasure"), () => editorDeleteMeasurement(sessionId!, m.id))
                }
              >
                ×
              </button>
            </li>
          ))}
          {properties.coord_points.map((cp) => (
            <li key={cp.id} className="pc-db-item">
              <span className="pc-db-name">{cp.label || tr("toolCoordPoint")}</span>
            </li>
          ))}
          {properties.hidden_regions.length === 0 &&
            properties.breaklines.length === 0 &&
            properties.measurements.length === 0 &&
            properties.coord_points.length === 0 && (
              <li className="pc-db-empty-item">{tr("dbTreeNoAnnotations")}</li>
            )}
        </ul>
        {properties.hidden_regions.length > 0 && (
          <button
            type="button"
            className="pc-db-action"
            onClick={() => void run(tr("dbTreeClearRegions"), () => editorClearRegions(sessionId!))}
          >
            {tr("dbTreeClearRegions")}
          </button>
        )}
      </details>

      <details className="pc-db-group">
        <summary>{tr("dbTreeDerived")}</summary>
        <ul className="pc-db-list">
          <li className={`pc-db-item ${grid.enabled ? "active" : ""}`}>
            <span className="pc-db-name">
              {tr("dbTreeGrid")} {grid.enabled ? `(${grid.cell_size}m)` : ""}
            </span>
            {grid.has_data && (
              <span className="pc-db-badge">{tr("gridDataReady")}</span>
            )}
          </li>
          <li className={`pc-db-item ${mesh ? "active" : ""}`}>
            <span className="pc-db-name">
              {tr("dbTreeMesh")}{" "}
              {mesh ? `(${mesh.vertices} ${tr("pcPropVertices")}, ${mesh.triangles} tri)` : "—"}
            </span>
          </li>
        </ul>
      </details>

      <p className="pc-db-footer">
        {properties.total_points.toLocaleString()} {tr("pcPreviewPoints")} ·{" "}
        {formatFileSize(properties.files.reduce((s, f) => s + f.size_bytes, 0))}
      </p>
    </div>
  );
}
