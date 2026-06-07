import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
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
      <div className="tp-status-left">
        {totalPoints != null && (
          <span className="tp-status-points">
            {totalPoints.toLocaleString()} {tr("pcPreviewPoints")}
          </span>
        )}
        <span className="tp-status-tool">
          {tr("statusTool")}: {tr(toolLabelKey(activeTool) as TranslationKey)}
        </span>
      </div>
      <div className="tp-status-center">
        {snapCoords ? (
          <span className="tp-status-xyz">
            X: <strong>{snapCoords[0].toFixed(3)}</strong>
            {" · "}
            Y: <strong>{snapCoords[1].toFixed(3)}</strong>
          </span>
        ) : (
          <span className="tp-status-xyz tp-status-xyz-empty">{tr("statusCursorEmpty")}</span>
        )}
      </div>
      <div className="tp-status-right">
        {crsName && <span className="tp-status-crs">{crsName}</span>}
        {lastResult && (
          <span className="pc-status-result">
            {tr("statusResult")}: {lastResult}
          </span>
        )}
      </div>
    </div>
  );
}
