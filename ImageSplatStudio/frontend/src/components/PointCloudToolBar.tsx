import { useI18n } from "../i18n/I18nProvider";
import type { EditorTool } from "../utils/editorTools";

interface PointCloudToolBarProps {
  activeTool: EditorTool;
  osnapEnabled: boolean;
  breaklineCount: number;
  meshReady: boolean;
  onToolChange: (tool: EditorTool) => void;
  onOsnapToggle: (enabled: boolean) => void;
  onFinishBreakline: () => void;
}

export function PointCloudToolBar({
  activeTool,
  osnapEnabled,
  breaklineCount,
  meshReady,
  onToolChange,
  onOsnapToggle,
  onFinishBreakline,
}: PointCloudToolBarProps) {
  const { tr } = useI18n();

  const tools: { id: EditorTool; label: string; needsMesh?: boolean }[] = [
    { id: "navigate", label: tr("toolNavigate") },
    { id: "delete_point", label: tr("toolDeletePoint") },
    { id: "add_point", label: tr("toolAddPoint") },
    { id: "select_region", label: tr("toolSelectRegion") },
    { id: "mesh_add", label: tr("toolMeshAdd"), needsMesh: true },
    { id: "mesh_delete", label: tr("toolMeshDelete"), needsMesh: true },
    { id: "breakline", label: tr("toolBreakline"), needsMesh: true },
  ];

  return (
    <div className="pc-tool-bar">
      <span className="pc-tool-bar-label">{tr("toolBarTitle")}</span>
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`pc-tool-btn ${activeTool === t.id ? "active" : ""}`}
          disabled={t.needsMesh && !meshReady}
          title={t.needsMesh && !meshReady ? tr("toolNeedsMesh") : undefined}
          onClick={() => onToolChange(t.id)}
        >
          {t.label}
        </button>
      ))}
      <label className="pc-osnap-toggle">
        <input type="checkbox" checked={osnapEnabled} onChange={(e) => onOsnapToggle(e.target.checked)} />
        {tr("toolOsnap")}
      </label>
      {activeTool === "breakline" && breaklineCount > 0 && (
        <button type="button" className="pc-tool-btn pc-tool-btn-accent" onClick={onFinishBreakline}>
          {tr("toolFinishBreakline")} ({breaklineCount})
        </button>
      )}
    </div>
  );
}
