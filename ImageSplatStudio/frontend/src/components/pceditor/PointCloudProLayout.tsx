import { useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { PointCloudConsole } from "./PointCloudConsole";
import { PointCloudDbTree } from "./PointCloudDbTree";
import { PointCloudDisplayRibbon } from "./PointCloudDisplayRibbon";
import { PointCloudFileRibbon } from "./PointCloudFileRibbon";
import { PointCloudFilterRibbon } from "./PointCloudFilterRibbon";
import { PointCloudIconRibbon } from "./PointCloudIconRibbon";
import { PointCloudInspector, type InspectedPoint } from "./PointCloudInspector";
import { PointCloudProcessRibbon } from "./PointCloudProcessRibbon";
import { PointCloudSurveyRibbon } from "./PointCloudSurveyRibbon";
import type { EditorProperties } from "../../api/editor";
import type { ClipMode, EditorTool, OsnapMode } from "../../utils/editorTools";
import type { NormMeta } from "../../utils/coordTransform";
import { useHorizontalResize, useVerticalResize } from "../../utils/usePanelResize";

import type { ContourData, VolumeResult } from "../../utils/editorTools";

type ProTab = "file" | "tools" | "display" | "filter" | "process" | "survey";

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
  crossSectionWidth: number;
  onCrossSectionWidthChange: (v: number) => void;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: (fitTarget?: { start_index: number; point_count: number }) => void;
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
  crossSectionWidth,
  onCrossSectionWidthChange,
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
  const [ribbonTab, setRibbonTab] = useState<ProTab>("file");
  const [consoleCollapsed, setConsoleCollapsed] = useState(true);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  const propsPanel = useHorizontalResize("iss-pro-props-width", 280, 200, 560);
  const rightPanel = useHorizontalResize("iss-pro-right-width", 260, 180, 420, true);
  const ribbonPanel = useVerticalResize("iss-pro-ribbon-height", 96, 36, 280);

  const normMeta = properties?.norm_meta as NormMeta | undefined;

  const ribbonContent =
    ribbonTab === "file" ? (
      <PointCloudFileRibbon
        sessionId={sessionId}
        properties={properties}
        onUpdated={onUpdated}
        onRefreshPreview={onRefreshPreview}
        onError={onError}
      />
    ) : ribbonTab === "tools" ? (
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
    ) : ribbonTab === "display" ? (
      <PointCloudDisplayRibbon
        sessionId={sessionId}
        properties={properties}
        onUpdated={onUpdated}
        onRefreshPreview={onRefreshPreview}
        onError={onError}
      />
    ) : ribbonTab === "filter" ? (
      <PointCloudFilterRibbon
        sessionId={sessionId}
        onUpdated={onUpdated}
        onRefreshPreview={onRefreshPreview}
        onError={onError}
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
        crossSectionWidth={crossSectionWidth}
        onCrossSectionWidthChange={onCrossSectionWidthChange}
        onUpdated={onUpdated}
        onRefreshPreview={onRefreshPreview}
        onError={onError}
        onContoursReady={onContoursReady}
        onVolumeResult={onVolumeResult}
        onDeviationReady={onDeviationReady}
        onStartDensityRegion={onStartDensityRegion}
      />
    );

  return (
    <div className="pc-pro-layout">
      <div className="pc-pro-ribbon-area" style={{ height: ribbonPanel.size }}>
        <div className="pc-pro-ribbon-tabs">
          <button
            type="button"
            className={ribbonTab === "file" ? "active" : ""}
            onClick={() => setRibbonTab("file")}
          >
            {tr("chromeTabFile")}
          </button>
          <button
            type="button"
            className={ribbonTab === "tools" ? "active" : ""}
            onClick={() => setRibbonTab("tools")}
          >
            {tr("chromeTabTools")}
          </button>
          <button
            type="button"
            className={ribbonTab === "display" ? "active" : ""}
            onClick={() => setRibbonTab("display")}
          >
            {tr("chromeTabDisplay")}
          </button>
          <button
            type="button"
            className={ribbonTab === "filter" ? "active" : ""}
            onClick={() => setRibbonTab("filter")}
          >
            {tr("chromeTabFilter")}
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
        <div className="pc-pro-ribbon-content">{ribbonContent}</div>
        <div
          className="pc-pro-resizer pc-pro-resizer-ribbon"
          title={tr("resizeRibbonHint")}
          onMouseDown={(e) => ribbonPanel.onResizeStart(e)}
          onDoubleClick={() => ribbonPanel.setSize(96)}
        />
      </div>

      <div className="pc-pro-body">
        {!leftCollapsed && (
          <aside className="pc-pro-left pc-pro-left-props" style={{ width: propsPanel.size }}>
            <div className="pc-pro-panel-head">
              <span>{tr("pcPropertyTitle")}</span>
              <button type="button" onClick={() => setLeftCollapsed(true)} title={tr("panelCollapse")}>
                ◀
              </button>
            </div>
            <div className="pc-pro-props">{propertyPanel}</div>
            <div
              className="pc-pro-resizer pc-pro-resizer-left"
              title={tr("resizePanelHint")}
              onMouseDown={(e) => propsPanel.onResizeStart(e)}
            />
          </aside>
        )}
        {leftCollapsed && (
          <button
            type="button"
            className="pc-pro-expand pc-pro-expand-left"
            onClick={() => setLeftCollapsed(false)}
            title={tr("pcPropertyTitle")}
          >
            ▶
          </button>
        )}

        <div className="pc-pro-center">
          <div className="pc-pro-viewport">{viewport}</div>
          <PointCloudConsole collapsed={consoleCollapsed} onToggle={() => setConsoleCollapsed((v) => !v)} />
          {statusBar}
        </div>

        {!rightCollapsed && (
          <aside className="pc-pro-right" style={{ width: rightPanel.size }}>
            <div
              className="pc-pro-resizer pc-pro-resizer-right"
              title={tr("resizePanelHint")}
              onMouseDown={(e) => rightPanel.onResizeStart(e)}
            />
            <div className="pc-pro-panel-head">
              <span>{tr("dbTreeTitle")}</span>
              <button type="button" onClick={() => setRightCollapsed(true)} title={tr("panelCollapse")}>
                ▶
              </button>
            </div>
            <PointCloudDbTree
              sessionId={sessionId}
              properties={properties}
              onUpdated={onUpdated}
              onRefreshPreview={onRefreshPreview}
              onError={onError}
            />
            <div className="pc-pro-panel-head pc-pro-panel-head-secondary">
              <span>{tr("inspectorPanel")}</span>
            </div>
            <PointCloudInspector
              point={inspectedPoint}
              normMeta={normMeta}
              swapXy={properties?.swap_xy}
              totalPoints={properties?.total_points}
            />
          </aside>
        )}
        {rightCollapsed && (
          <button
            type="button"
            className="pc-pro-expand pc-pro-expand-right"
            onClick={() => setRightCollapsed(false)}
            title={tr("dbTreeTitle")}
          >
            ◀
          </button>
        )}
      </div>
    </div>
  );
}
