import { useI18n } from "../i18n/I18nProvider";
import { editorConfigureGrid, editorSetVisibility, type EditorProperties } from "../api/editor";
import { formatFileSize } from "../utils/pointcloud";

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
      <div className="panel pc-property-panel empty">
        <h3>{tr("pcPropertyTitle")}</h3>
        <p className="muted">{tr("pcPropertyEmpty")}</p>
      </div>
    );
  }

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

  return (
    <div className="panel pc-property-panel">
      <h3>{tr("pcPropertyTitle")}</h3>
      <div className="pc-property-summary muted">
        {properties.total_points.toLocaleString()} {tr("pcPreviewPoints")}
        {properties.swap_xy ? ` · ${tr("pcMenuSwapXy")}` : ""}
        {properties.hidden_regions.length > 0
          ? ` · ${properties.hidden_regions.length} ${tr("pcHiddenRegions")}`
          : ""}
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
    </div>
  );
}
