import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { toolLabelKey, type EditorTool } from "../utils/editorTools";

interface PointCloudStatusBarProps {
  activeTool: EditorTool;
  snapCoords: [number, number, number] | null;
  totalPoints: number | null;
  lastResult: string | null;
}

export function PointCloudStatusBar({
  activeTool,
  snapCoords,
  totalPoints,
  lastResult,
}: PointCloudStatusBarProps) {
  const { tr } = useI18n();

  return (
    <div className="pc-status-bar">
      <span>
        {tr("statusTool")}: <strong>{tr(toolLabelKey(activeTool) as TranslationKey)}</strong>
      </span>
      {totalPoints != null && (
        <span>
          {tr("pcPreviewPoints")}: <strong>{totalPoints.toLocaleString()}</strong>
        </span>
      )}
      {snapCoords && (
        <span>
          X: <strong>{snapCoords[0].toFixed(4)}</strong> Y: <strong>{snapCoords[1].toFixed(4)}</strong> Z:{" "}
          <strong>{snapCoords[2].toFixed(4)}</strong>
        </span>
      )}
      {lastResult && (
        <span className="pc-status-result">
          {tr("statusResult")}: <strong>{lastResult}</strong>
        </span>
      )}
    </div>
  );
}
