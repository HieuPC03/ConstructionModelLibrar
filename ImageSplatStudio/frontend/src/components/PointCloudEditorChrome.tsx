import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { PointCloudMenuBar } from "./PointCloudMenuBar";
import { PointCloudToolBar } from "./PointCloudToolBar";
import type { EditorProperties } from "../api/editor";
import type { ClipMode, EditorTool, OsnapMode } from "../utils/editorTools";

type ChromeTab = "tools" | "process" | "mesh";

interface PointCloudEditorChromeProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  activeTool: EditorTool;
  osnapMode: OsnapMode;
  clipMode: ClipMode;
  deleteRadius: number;
  breaklineCount: number;
  polygonCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
  onToolChange: (tool: EditorTool) => void;
  onOsnapModeChange: (mode: OsnapMode) => void;
  onClipModeChange: (mode: ClipMode) => void;
  onDeleteRadiusChange: (radius: number) => void;
  onFinishBreakline: () => void;
  onFinishPolygon: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function PointCloudEditorChrome(props: PointCloudEditorChromeProps) {
  const { tr } = useI18n();
  const [tab, setTab] = useState<ChromeTab>("tools");

  const tabs: { id: ChromeTab; label: string }[] = [
    { id: "tools", label: tr("chromeTabTools") },
    { id: "process", label: tr("chromeTabProcess") },
    { id: "mesh", label: tr("chromeTabMesh") },
  ];

  return (
    <div className="pc-editor-chrome">
      <div className="pc-chrome-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`pc-chrome-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <PointCloudToolBar
          compact
          activeTool={props.activeTool}
          osnapMode={props.osnapMode}
          clipMode={props.clipMode}
          deleteRadius={props.deleteRadius}
          breaklineCount={props.breaklineCount}
          polygonCount={props.polygonCount}
          meshReady={!!props.properties?.mesh}
          canUndo={props.canUndo}
          canRedo={props.canRedo}
          onToolChange={props.onToolChange}
          onOsnapModeChange={props.onOsnapModeChange}
          onClipModeChange={props.onClipModeChange}
          onDeleteRadiusChange={props.onDeleteRadiusChange}
          onFinishBreakline={props.onFinishBreakline}
          onFinishPolygon={props.onFinishPolygon}
          onUndo={props.onUndo}
          onRedo={props.onRedo}
        />
      )}

      {tab === "process" && (
        <PointCloudMenuBar
          compact
          sessionId={props.sessionId}
          properties={props.properties}
          onUpdated={props.onUpdated}
          onRefreshPreview={props.onRefreshPreview}
          onError={props.onError}
        />
      )}

      {tab === "mesh" && (
        <div className="pc-chrome-mesh-tab">
          <PointCloudMenuBar
            compact
            meshOnly
            sessionId={props.sessionId}
            properties={props.properties}
            onUpdated={props.onUpdated}
            onRefreshPreview={props.onRefreshPreview}
            onError={props.onError}
          />
          <PointCloudToolBar
            compact
            meshToolsOnly
            activeTool={props.activeTool}
            osnapMode={props.osnapMode}
            clipMode={props.clipMode}
            deleteRadius={props.deleteRadius}
            breaklineCount={props.breaklineCount}
            polygonCount={props.polygonCount}
            meshReady={!!props.properties?.mesh}
            canUndo={props.canUndo}
            canRedo={props.canRedo}
            onToolChange={props.onToolChange}
            onOsnapModeChange={props.onOsnapModeChange}
            onClipModeChange={props.onClipModeChange}
            onDeleteRadiusChange={props.onDeleteRadiusChange}
            onFinishBreakline={props.onFinishBreakline}
            onFinishPolygon={props.onFinishPolygon}
            onUndo={props.onUndo}
            onRedo={props.onRedo}
          />
        </div>
      )}
    </div>
  );
}
