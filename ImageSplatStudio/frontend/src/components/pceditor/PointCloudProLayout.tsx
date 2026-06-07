import { useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { PointCloudConsole } from "./PointCloudConsole";
import { PointCloudDbTree } from "./PointCloudDbTree";
import { PointCloudIconRibbon } from "./PointCloudIconRibbon";
import { PointCloudInspector, type InspectedPoint } from "./PointCloudInspector";
import { PointCloudProcessRibbon } from "./PointCloudProcessRibbon";
import { PointCloudSurveyRibbon } from "./PointCloudSurveyRibbon";
import type { EditorProperties } from "../../api/editor";
import type { ClipMode, EditorTool, OsnapMode } from "../../utils/editorTools";
import type { NormMeta } from "../../utils/coordTransform";

import type { ContourData, VolumeResult } from "../../utils/editorTools";

type ProTab = "tools" | "process" | "survey";

interface PointCloudProLayoutProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  activeTool: EditorTool;
  osnapMode: OsnapMode;
  clipMode: ClipMode;
  deleteRadius: number;
  breaklineCount: number;
  polygonCount: number;
  inspectedPoint: InspectedPoint | null;
  gridCellSize: number;
  onGridCellSizeChange: (v: number) => void;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
  onToolChange: (tool: EditorTool) => void;
  onCancelCommand?: () => void;
  onOsnapModeChange: (mode: OsnapMode) => void;
  onClipModeChange: (mode: ClipMode) => void;
  onDeleteRadiusChange: (radius: number) => void;
  onFinishBreakline: () => void;
  onFinishPolygon: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onStartGridRegion: () => void;
  onCreateGrid: () => void;
  onContoursReady: (data: ContourData) => void;
  onVolumeResult: (result: VolumeResult) => void;
  onDeviationReady: (data: import("../../api/editor").DeviationHeatmap) => void;
  onStartDensityRegion: () => void;
  viewport: ReactNode;
  propertyPanel: ReactNode;
  statusBar: ReactNode;
}

export function PointCloudProLayout({
  sessionId,
  properties,
  activeTool,
  osnapMode,
  clipMode,
  deleteRadius,
  breaklineCount,
  polygonCount,
  inspectedPoint,
  gridCellSize,
  onUpdated,
  onRefreshPreview,
  onError,
  onToolChange,
  onCancelCommand,
  onOsnapModeChange,
  onClipModeChange,
  onDeleteRadiusChange,
  onFinishBreakline,
  onFinishPolygon,
  onUndo,
  onRedo,
  onContoursReady,
  onVolumeResult,
  onDeviationReady,
  onStartDensityRegion,
  viewport,
  propertyPanel,
  statusBar,
}: PointCloudProLayoutProps) {
  const { tr } = useI18n();
  const [ribbonTab, setRibbonTab] = useState<ProTab>("tools");
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(300);
  const [consoleCollapsed, setConsoleCollapsed] = useState(true);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const normMeta = properties?.norm_meta as NormMeta | undefined;

  return (
    <div className="pc-pro-layout">
      <div className="pc-pro-ribbon-tabs">
        <button
          type="button"
          className={ribbonTab === "tools" ? "active" : ""}
          onClick={() => setRibbonTab("tools")}
        >
          {tr("chromeTabTools")}
        </button>
        <button
          type="button"
          className={ribbonTab === "process" ? "active" : ""}
          onClick={() => setRibbonTab("process")}
        >
          {tr("chromeTabProcess")}
        </button>
        <button
          type="button"
          className={ribbonTab === "survey" ? "active" : ""}
          onClick={() => setRibbonTab("survey")}
        >
          {tr("chromeTabSurvey")}
        </button>
      </div>

      {ribbonTab === "tools" ? (
        <PointCloudIconRibbon
          activeTool={activeTool}
          osnapMode={osnapMode}
          clipMode={clipMode}
          deleteRadius={deleteRadius}
          breaklineCount={breaklineCount}
          polygonCount={polygonCount}
          meshReady={!!properties?.mesh}
          canUndo={!!properties?.can_undo}
          canRedo={!!properties?.can_redo}
          onToolChange={onToolChange}
          onCancelCommand={onCancelCommand}
          onOsnapModeChange={onOsnapModeChange}
          onClipModeChange={onClipModeChange}
          onDeleteRadiusChange={onDeleteRadiusChange}
          onFinishBreakline={onFinishBreakline}
          onFinishPolygon={onFinishPolygon}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      ) : ribbonTab === "process" ? (
        <PointCloudProcessRibbon
          sessionId={sessionId}
          properties={properties}
          onUpdated={onUpdated}
          onRefreshPreview={onRefreshPreview}
          onError={onError}
        />
      ) : (
        <PointCloudSurveyRibbon
          sessionId={sessionId}
          properties={properties}
          gridCellSize={gridCellSize}
          onUpdated={onUpdated}
          onRefreshPreview={onRefreshPreview}
          onError={onError}
          onContoursReady={onContoursReady}
          onVolumeResult={onVolumeResult}
          onDeviationReady={onDeviationReady}
          onStartDensityRegion={onStartDensityRegion}
        />
      )}

      <div className="pc-pro-body">
        {!leftCollapsed && (
          <aside className="pc-pro-left" style={{ width: leftWidth }}>
            <div className="pc-pro-panel-head">
              <span>{tr("dbTreeTitle")}</span>
              <button type="button" onClick={() => setLeftCollapsed(true)} title={tr("panelCollapse")}>
                ◀
              </button>
            </div>
            <PointCloudDbTree
              sessionId={sessionId}
              properties={properties}
              onUpdated={onUpdated}
              onRefreshPreview={onRefreshPreview}
              onError={onError}
            />
            <div
              className="pc-pro-resizer pc-pro-resizer-left"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = leftWidth;
                const onMove = (ev: MouseEvent) => setLeftWidth(Math.max(180, Math.min(420, startW + ev.clientX - startX)));
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
          </aside>
        )}
        {leftCollapsed && (
          <button type="button" className="pc-pro-expand pc-pro-expand-left" onClick={() => setLeftCollapsed(false)}>
            ▶
          </button>
        )}

        <div className="pc-pro-center">
          <div className="pc-pro-viewport">{viewport}</div>
          <PointCloudConsole collapsed={consoleCollapsed} onToggle={() => setConsoleCollapsed((v) => !v)} />
          {statusBar}
        </div>

        {!rightCollapsed && (
          <aside className="pc-pro-right" style={{ width: rightWidth }}>
            <div
              className="pc-pro-resizer pc-pro-resizer-right"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = rightWidth;
                const onMove = (ev: MouseEvent) =>
                  setRightWidth(Math.max(220, Math.min(480, startW - (ev.clientX - startX))));
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
            <div className="pc-pro-panel-head">
              <span>{tr("inspectorPanel")}</span>
              <button type="button" onClick={() => setRightCollapsed(true)} title={tr("panelCollapse")}>
                ▶
              </button>
            </div>
            <PointCloudInspector
              point={inspectedPoint}
              normMeta={normMeta}
              swapXy={properties?.swap_xy}
              totalPoints={properties?.total_points}
            />
            <div className="pc-pro-props">{propertyPanel}</div>
          </aside>
        )}
        {rightCollapsed && (
          <button type="button" className="pc-pro-expand pc-pro-expand-right" onClick={() => setRightCollapsed(false)}>
            ◀
          </button>
        )}
      </div>
    </div>
  );
}
