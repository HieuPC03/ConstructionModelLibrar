import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import {
  editorCleanOutliers,
  editorFilterDensity,
  editorFilterGround,
  type EditorProperties,
} from "../../api/editor";
import { logConsole } from "../../utils/consoleLog";

interface PointCloudFilterRibbonProps {
  sessionId: string | null;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
}

export function PointCloudFilterRibbon({
  sessionId,
  onUpdated,
  onRefreshPreview,
  onError,
}: PointCloudFilterRibbonProps) {
  const { tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [densityRadius, setDensityRadius] = useState(0.05);
  const [densityNeighbors, setDensityNeighbors] = useState(5);
  const [groundCell, setGroundCell] = useState(1.0);
  const [groundOffset, setGroundOffset] = useState(0.5);
  const disabled = !sessionId || busy;

  const run = async (label: string, fn: () => Promise<EditorProperties & { removed_count?: number }>) => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const props = await fn();
      onUpdated(props);
      onRefreshPreview();
      const extra = props.removed_count != null ? ` (−${props.removed_count.toLocaleString()})` : "";
      logConsole(`${label}${extra}`, "success");
    } catch (e: unknown) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pc-process-ribbon pc-filter-ribbon">
      <div className="pc-process-row">
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("pcMenuFilter")}</span>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void run(tr("pcMenuCleanPoints"), () => editorCleanOutliers(sessionId!))}
          >
            {tr("pcMenuCleanPoints")}
          </button>
        </div>
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("pcMenuFilterDensity")}</span>
          <label className="pc-process-inline">
            r={densityRadius.toFixed(2)}m
            <input type="range" min={0.01} max={0.2} step={0.01} value={densityRadius} onChange={(e) => setDensityRadius(Number(e.target.value))} />
          </label>
          <label className="pc-process-inline">
            N≥{densityNeighbors}
            <input type="range" min={3} max={20} step={1} value={densityNeighbors} onChange={(e) => setDensityNeighbors(Number(e.target.value))} />
          </label>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() =>
              void run(tr("pcMenuFilterDensity"), () =>
                editorFilterDensity(sessionId!, densityRadius, densityNeighbors),
              )
            }
          >
            {tr("filterApply")}
          </button>
        </div>
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("pcMenuFilterGround")}</span>
          <label className="pc-process-inline">
            cell={groundCell.toFixed(2)}m
            <input type="range" min={0.2} max={5} step={0.1} value={groundCell} onChange={(e) => setGroundCell(Number(e.target.value))} />
          </label>
          <label className="pc-process-inline">
            +{groundOffset.toFixed(2)}m
            <input type="range" min={0.1} max={2} step={0.05} value={groundOffset} onChange={(e) => setGroundOffset(Number(e.target.value))} />
          </label>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() =>
              void run(tr("pcMenuFilterGround"), () =>
                editorFilterGround(sessionId!, groundCell, groundOffset),
              )
            }
          >
            {tr("filterApply")}
          </button>
        </div>
      </div>
    </div>
  );
}
