import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import {
  MESH_TOOLS,
  TOOL_GROUPS,
  toolLabelKey,
  type ClipMode,
  type EditorTool,
  type OsnapMode,
} from "../utils/editorTools";

interface PointCloudToolBarProps {
  activeTool: EditorTool;
  osnapMode: OsnapMode;
  clipMode: ClipMode;
  deleteRadius: number;
  breaklineCount: number;
  polygonCount: number;
  meshReady: boolean;
  canUndo: boolean;
  canRedo: boolean;
  compact?: boolean;
  meshToolsOnly?: boolean;
  onToolChange: (tool: EditorTool) => void;
  onOsnapModeChange: (mode: OsnapMode) => void;
  onClipModeChange: (mode: ClipMode) => void;
  onDeleteRadiusChange: (radius: number) => void;
  onFinishBreakline: () => void;
  onFinishPolygon: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function PointCloudToolBar({
  activeTool,
  osnapMode,
  clipMode,
  deleteRadius,
  breaklineCount,
  polygonCount,
  meshReady,
  canUndo,
  canRedo,
  compact = false,
  meshToolsOnly = false,
  onToolChange,
  onOsnapModeChange,
  onClipModeChange,
  onDeleteRadiusChange,
  onFinishBreakline,
  onFinishPolygon,
  onUndo,
  onRedo,
}: PointCloudToolBarProps) {
  const { tr } = useI18n();

  const groups = meshToolsOnly
    ? TOOL_GROUPS.filter((g) => g.id === "mesh")
    : TOOL_GROUPS.filter((g) => g.id !== "mesh");

  const showOptions =
    activeTool === "delete_point" ||
    activeTool === "polygon_delete" ||
    activeTool === "clip_box" ||
    activeTool === "breakline" ||
    activeTool === "measure_area";

  return (
    <div className={`pc-tool-bar ${compact ? "pc-tool-bar-compact" : ""}`}>
      <div className="pc-tool-bar-row">
        {!compact && <span className="pc-tool-bar-label">{tr("toolBarTitle")}</span>}
        <button type="button" className="pc-tool-btn" disabled={!canUndo} onClick={onUndo} title={tr("toolUndo")}>
          ↶
        </button>
        <button type="button" className="pc-tool-btn" disabled={!canRedo} onClick={onRedo} title={tr("toolRedo")}>
          ↷
        </button>
        <span className="pc-tool-sep" />
        {groups.map((group) => (
          <div key={group.id} className="pc-tool-group">
            {!compact && <span className="pc-tool-group-label">{tr(group.labelKey as TranslationKey)}</span>}
            {group.tools.map((id) => {
              const needsMesh = MESH_TOOLS.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`pc-tool-btn ${activeTool === id ? "active" : ""}`}
                  disabled={needsMesh && !meshReady}
                  title={tr(toolLabelKey(id) as TranslationKey)}
                  onClick={() => onToolChange(id)}
                >
                  {tr(toolLabelKey(id) as TranslationKey)}
                </button>
              );
            })}
          </div>
        ))}
        {!meshToolsOnly && (
          <>
            <span className="pc-tool-sep" />
            <label className="pc-osnap-select">
              {compact ? "Snap" : tr("toolOsnap")}
              <select value={osnapMode} onChange={(e) => onOsnapModeChange(e.target.value as OsnapMode)}>
                <option value="point">{tr("osnapPoint")}</option>
                <option value="mesh">{tr("osnapMesh")}</option>
                <option value="off">{tr("osnapOff")}</option>
              </select>
            </label>
          </>
        )}
      </div>

      {showOptions && (
        <div className="pc-tool-bar-row pc-tool-options">
          {(activeTool === "delete_point" || activeTool === "polygon_delete") && (
            <label className="pc-tool-option">
              {tr("toolDeleteRadius")}{" "}
              <input
                type="range"
                min={0.005}
                max={0.15}
                step={0.005}
                value={deleteRadius}
                onChange={(e) => onDeleteRadiusChange(Number(e.target.value))}
              />
              <strong>{(deleteRadius * 100).toFixed(1)}%</strong>
            </label>
          )}
          {activeTool === "clip_box" && (
            <label className="pc-tool-option">
              {tr("toolClipMode")}
              <select value={clipMode} onChange={(e) => onClipModeChange(e.target.value as ClipMode)}>
                <option value="inside">{tr("clipInside")}</option>
                <option value="outside">{tr("clipOutside")}</option>
              </select>
            </label>
          )}
          {activeTool === "breakline" && breaklineCount > 0 && (
            <button type="button" className="pc-tool-btn pc-tool-btn-accent" onClick={onFinishBreakline}>
              {tr("toolFinishBreakline")} ({breaklineCount})
            </button>
          )}
          {activeTool === "polygon_delete" && polygonCount >= 3 && (
            <button type="button" className="pc-tool-btn pc-tool-btn-accent" onClick={onFinishPolygon}>
              {tr("toolFinishPolygon")} ({polygonCount})
            </button>
          )}
          {activeTool === "measure_area" && polygonCount >= 3 && (
            <button type="button" className="pc-tool-btn pc-tool-btn-accent" onClick={onFinishPolygon}>
              {tr("toolFinishMeasure")} ({polygonCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
