import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { formatWorldCoords } from "../utils/coordTransform";
import { toolLabelKey, type EditorTool } from "../utils/editorTools";

interface PointCloudStatusBarProps {
  activeTool: EditorTool;
  snapCoords: [number, number, number] | null;
  totalPoints: number | null;
  lastResult: string | null;
  crsName?: string;
}

export function PointCloudStatusBar({
  activeTool,
  snapCoords,
  totalPoints,
  lastResult,
  crsName,
}: PointCloudStatusBarProps) {
  const { tr } = useI18n();

  return (
    <div className="pc-status-bar tp-status-bar">
      <span>
        {tr("statusTool")}: <strong>{tr(toolLabelKey(activeTool) as TranslationKey)}</strong>
      </span>
      {crsName && (
        <span>
          CRS: <strong>{crsName}</strong>
        </span>
      )}
      {totalPoints != null && (
        <span>
          {tr("pcPreviewPoints")}: <strong>{totalPoints.toLocaleString()}</strong>
        </span>
      )}
      {snapCoords && (
        <span>
          {tr("statusWorldCoords")}: <strong>{formatWorldCoords(snapCoords, 4)}</strong>
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
