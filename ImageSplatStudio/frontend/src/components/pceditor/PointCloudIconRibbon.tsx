import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translations";
import {
  MESH_TOOLS,
  TOOL_GROUPS,
  toolLabelKey,
  type ClipMode,
  type EditorTool,
  type OsnapMode,
} from "../../utils/editorTools";

function IconNav() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M12 2L4 9v11h5v-6h6v6h5V9z" />
    </svg>
  );
}

function IconEraser() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M16 3l5 5-9 9H7v-5L16 3zm-2 2L9 10v2h2l5-5-2-2zM5 21h14v2H5z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M12 2a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M4 8l8-4 8 4v8l-8 4-8-4z" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5C21.3 7.6 17 4.5 12 4.5zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"
      />
    </svg>
  );
}

function IconPoly() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M6 18L3 8l9-4 9 4-3 10z" />
    </svg>
  );
}

function IconRuler() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M2 8h2v8H2V8zm4-2h2v12H6V6zm4 1h2v10h-2V7zm4-2h2v12h-2V5zm4 3h2v9h-2V8z" />
    </svg>
  );
}

function IconArea() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M4 20h16V4H4v16zM8 8h8v8H8z" />
    </svg>
  );
}

function IconLine() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M4 20L20 4" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        d="M4 4h16v16H4zM4 12h16M12 4v16"
      />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62C8.55 10.52 10.43 10 12.5 10c3.31 0 6 2.69 6 6s-2.69 6-6 6H8v2h4.5c4.42 0 8-3.58 8-8s-3.58-8-8-8z" />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M18.4 10.6C16.55 9 14.15 8 11.5 8 7.08 8 3.5 11.58 3.5 16S7.08 24 11.5 24H16v-2h-4.5c-3.31 0-6-2.69-6-6s2.69-6 6-6c2.07 0 3.95.52 5.62 1.38L13 16h9V7l-3.6 3.6z" />
    </svg>
  );
}

function IconLasso() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M4 18c4-8 8-12 12-14s6 2 4 6-8 8-12 10"
      />
    </svg>
  );
}

function IconClassify() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
    </svg>
  );
}

function IconAngle() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M4 20 L12 4 L20 16" />
    </svg>
  );
}

function IconSection() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M4 18 L20 18 M8 6 L16 14" />
    </svg>
  );
}

const TOOL_ICONS: Partial<Record<EditorTool, () => JSX.Element>> = {
  navigate: IconNav,
  delete_point: IconEraser,
  add_point: IconPlus,
  coord_point: IconPin,
  clip_box: IconBox,
  hide_region: IconEyeOff,
  polygon_delete: IconPoly,
  polygon_classify: IconClassify,
  lasso_select: IconLasso,
  measure_distance: IconRuler,
  measure_area: IconArea,
  measure_angle: IconAngle,
  cross_section: IconSection,
  mesh_add: IconPlus,
  mesh_delete: IconEraser,
  breakline: IconLine,
  grid_region: IconGrid,
};

interface PointCloudIconRibbonProps {
  activeTool: EditorTool;
  osnapMode: OsnapMode;
  clipMode: ClipMode;
  deleteRadius: number;
  breaklineCount: number;
  polygonCount: number;
  meshReady: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: EditorTool) => void;
  onCancelCommand?: () => void;
  onOsnapModeChange: (mode: OsnapMode) => void;
  onClipModeChange: (mode: ClipMode) => void;
  onDeleteRadiusChange: (radius: number) => void;
  onFinishBreakline: () => void;
  onFinishPolygon: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function PointCloudIconRibbon(props: PointCloudIconRibbonProps) {
  const { tr } = useI18n();
  const [activeTab, setActiveTab] = useState<"edit" | "measure" | "mesh">("edit");

  const tabGroups =
    activeTab === "mesh"
      ? TOOL_GROUPS.filter((g) => g.id === "mesh")
      : activeTab === "measure"
        ? TOOL_GROUPS.filter((g) => g.id === "measure" || g.id === "view")
        : TOOL_GROUPS.filter((g) => g.id !== "mesh" && g.id !== "measure");

  const showOptions =
    props.activeTool === "delete_point" ||
    props.activeTool === "polygon_delete" ||
    props.activeTool === "polygon_classify" ||
    props.activeTool === "clip_box" ||
    props.activeTool === "breakline" ||
    props.activeTool === "measure_area";

  return (
    <div className="pc-icon-ribbon">
      <div className="pc-ribbon-tabs">
        <button
          type="button"
          className={activeTab === "edit" ? "active" : ""}
          onClick={() => setActiveTab("edit")}
        >
          {tr("ribbonTabEdit")}
        </button>
        <button
          type="button"
          className={activeTab === "measure" ? "active" : ""}
          onClick={() => setActiveTab("measure")}
        >
          {tr("ribbonTabMeasure")}
        </button>
        <button
          type="button"
          className={activeTab === "mesh" ? "active" : ""}
          onClick={() => setActiveTab("mesh")}
        >
          {tr("ribbonTabMesh")}
        </button>
      </div>

      <div className="pc-ribbon-row">
        <div className="pc-ribbon-group">
          <button
            type="button"
            className={`pc-ribbon-btn pc-ribbon-btn-select ${props.activeTool === "navigate" ? "active" : ""}`}
            title={tr("toolSelectHint")}
            onClick={() => props.onCancelCommand?.()}
          >
            {tr("toolSelect")}
          </button>
        </div>
        <div className="pc-ribbon-group">
          <button
            type="button"
            className="pc-ribbon-btn"
            disabled={!props.canUndo}
            title={tr("toolUndo")}
            onClick={props.onUndo}
          >
            <IconUndo />
          </button>
          <button
            type="button"
            className="pc-ribbon-btn"
            disabled={!props.canRedo}
            title={tr("toolRedo")}
            onClick={props.onRedo}
          >
            <IconRedo />
          </button>
        </div>

        {tabGroups.map((group) => (
          <div key={group.id} className="pc-ribbon-group">
            <span className="pc-ribbon-label">{tr(group.labelKey as TranslationKey)}</span>
            {group.tools.map((id) => {
              const needsMesh = MESH_TOOLS.includes(id);
              const Icon = TOOL_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={`pc-ribbon-btn ${props.activeTool === id ? "active" : ""}`}
                  disabled={needsMesh && !props.meshReady}
                  title={tr(toolLabelKey(id) as TranslationKey)}
                  onClick={() => props.onToolChange(id)}
                >
                  {Icon ? <Icon /> : tr(toolLabelKey(id) as TranslationKey).slice(0, 2)}
                </button>
              );
            })}
            {group.id === "region" && (
              <button
                type="button"
                className={`pc-ribbon-btn ${props.activeTool === "grid_region" ? "active" : ""}`}
                title={tr("toolGridRegion")}
                onClick={() => props.onToolChange("grid_region")}
              >
                <IconGrid />
              </button>
            )}
          </div>
        ))}

        <div className="pc-ribbon-group pc-ribbon-osnap">
          <span className="pc-ribbon-label">{tr("toolOsnap")}</span>
          <select
            className="pc-ribbon-select"
            value={props.osnapMode}
            onChange={(e) => props.onOsnapModeChange(e.target.value as OsnapMode)}
          >
            <option value="point">{tr("osnapPoint")}</option>
            <option value="mesh">{tr("osnapMesh")}</option>
            <option value="off">{tr("osnapOff")}</option>
          </select>
        </div>
      </div>

      {showOptions && (
        <div className="pc-ribbon-options">
          {(props.activeTool === "delete_point" || props.activeTool === "polygon_delete") && (
            <label className="pc-ribbon-option">
              {tr("toolDeleteRadius")}
              <input
                type="range"
                min={0.005}
                max={0.15}
                step={0.005}
                value={props.deleteRadius}
                onChange={(e) => props.onDeleteRadiusChange(Number(e.target.value))}
              />
              <strong>{(props.deleteRadius * 100).toFixed(1)}%</strong>
            </label>
          )}
          {props.activeTool === "clip_box" && (
            <label className="pc-ribbon-option">
              {tr("toolClipMode")}
              <select
                value={props.clipMode}
                onChange={(e) => props.onClipModeChange(e.target.value as ClipMode)}
              >
                <option value="inside">{tr("clipInside")}</option>
                <option value="outside">{tr("clipOutside")}</option>
              </select>
            </label>
          )}
          {props.activeTool === "breakline" && props.breaklineCount > 0 && (
            <button type="button" className="pc-ribbon-accent" onClick={props.onFinishBreakline}>
              {tr("toolFinishBreakline")} ({props.breaklineCount})
            </button>
          )}
          {props.activeTool === "polygon_delete" && props.polygonCount >= 3 && (
            <button type="button" className="pc-ribbon-accent" onClick={props.onFinishPolygon}>
              {tr("toolFinishPolygon")} ({props.polygonCount})
            </button>
          )}
          {props.activeTool === "polygon_classify" && props.polygonCount >= 3 && (
            <button type="button" className="pc-ribbon-accent" onClick={props.onFinishPolygon}>
              {tr("toolFinishClassify")} ({props.polygonCount})
            </button>
          )}
          {props.activeTool === "measure_area" && props.polygonCount >= 3 && (
            <button type="button" className="pc-ribbon-accent" onClick={props.onFinishPolygon}>
              {tr("toolFinishMeasure")} ({props.polygonCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
