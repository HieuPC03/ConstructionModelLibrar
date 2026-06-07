import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import {
  editorCleanOutliers,
  editorCreateMesh,
  editorFilterDensity,
  editorFilterGround,
  editorSplit,
  editorSubsample,
  editorSwapXy,
  type EditorProperties,
} from "../../api/editor";
import { logConsole } from "../../utils/consoleLog";

interface PointCloudProcessRibbonProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
}

export function PointCloudProcessRibbon({
  sessionId,
  properties,
  onUpdated,
  onRefreshPreview,
  onError,
}: PointCloudProcessRibbonProps) {
  const { tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [densityRadius, setDensityRadius] = useState(0.05);
  const [densityNeighbors, setDensityNeighbors] = useState(5);
  const [groundCell, setGroundCell] = useState(1.0);
  const [groundOffset, setGroundOffset] = useState(0.5);
  const [subsampleRatio, setSubsampleRatio] = useState(0.5);
  const [meshMethod, setMeshMethod] = useState<"idw" | "poisson" | "bpa">("idw");
  const [meshCellSize, setMeshCellSize] = useState(properties?.grid?.cell_size ?? 0.2);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (properties?.grid?.cell_size) {
      setMeshCellSize(properties.grid.cell_size);
    }
  }, [properties?.grid?.cell_size]);

  const disabled = !sessionId || busy;

  const run = async (label: string, fn: () => Promise<EditorProperties & { removed_count?: number }>) => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const props = await fn();
      onUpdated(props);
      onRefreshPreview();
      const extra =
        props.removed_count != null ? ` (−${props.removed_count.toLocaleString()})` : "";
      logConsole(`${label}${extra}`, "success");
    } catch (e: unknown) {
      onError(String(e));
      logConsole(`${label}: ${String(e)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const mid = (axis: number) => {
    if (!properties) return 0;
    const mn = properties.bounds.min[axis];
    const mx = properties.bounds.max[axis];
    return (mn + mx) / 2;
  };

  return (
    <div className="pc-process-ribbon">
      <div className="pc-process-row">
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("pcMenuEdit")}</span>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void run(tr("pcMenuSwapXy"), () => editorSwapXy(sessionId!))}
          >
            {tr("pcMenuSwapXy")} {properties?.swap_xy ? "✓" : ""}
          </button>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void run(tr("pcMenuCleanPoints"), () => editorCleanOutliers(sessionId!))}
          >
            {tr("pcMenuCleanPoints")}
          </button>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void run(tr("processSubsample"), () => editorSubsample(sessionId!, subsampleRatio))}
          >
            {tr("processSubsample")}
          </button>
          <label className="pc-process-inline">
            {(subsampleRatio * 100).toFixed(0)}%
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={subsampleRatio}
              onChange={(e) => setSubsampleRatio(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("pcMenuTools")}</span>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void run(`${tr("pcMenuSplit")} X`, () => editorSplit(sessionId!, 0, mid(0)))}
          >
            {tr("pcMenuSplit")} X
          </button>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void run(`${tr("pcMenuSplit")} Y`, () => editorSplit(sessionId!, 1, mid(1)))}
          >
            Y
          </button>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void run(`${tr("pcMenuSplit")} Z`, () => editorSplit(sessionId!, 2, mid(2)))}
          >
            Z
          </button>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("pcMenuMesh")}</span>
          <select
            className="pc-ribbon-select"
            value={meshMethod}
            onChange={(e) => setMeshMethod(e.target.value as "idw" | "poisson" | "bpa")}
          >
            <option value="idw">{tr("meshMethodIdw")}</option>
            <option value="poisson">{tr("meshMethodPoisson")}</option>
            <option value="bpa">{tr("meshMethodBpa")}</option>
          </select>
          {(meshMethod === "idw") && (
            <label className="pc-process-inline">
              {tr("pcGridCellSize")} {meshCellSize.toFixed(2)}m
              <input
                type="range"
                min={0.05}
                max={2}
                step={0.05}
                value={meshCellSize}
                onChange={(e) => setMeshCellSize(Number(e.target.value))}
              />
            </label>
          )}
          <button
            type="button"
            className="pc-process-btn pc-process-accent"
            disabled={disabled}
            onClick={() =>
              void run(tr("pcMenuCreateMesh"), () =>
                editorCreateMesh(sessionId!, meshMethod, meshCellSize),
              )
            }
          >
            {busy ? tr("pcMenuWorking") : tr("pcMenuCreateMesh")}
          </button>
          {(meshMethod === "idw") && (
            <p className="pc-process-hint">{tr("meshMethodHint")}</p>
          )}
        </div>

        <button
          type="button"
          className="pc-process-btn"
          onClick={() => setShowFilters((v) => !v)}
        >
          {tr("pcMenuFilter")} {showFilters ? "▲" : "▼"}
        </button>
      </div>

      {showFilters && (
        <div className="pc-process-filters">
          <div className="pc-filter-block">
            <strong>{tr("pcMenuFilterDensity")}</strong>
            <label>
              r = {densityRadius.toFixed(2)}m
              <input
                type="range"
                min={0.01}
                max={0.2}
                step={0.01}
                value={densityRadius}
                onChange={(e) => setDensityRadius(Number(e.target.value))}
              />
            </label>
            <label>
              min N = {densityNeighbors}
              <input
                type="range"
                min={3}
                max={20}
                step={1}
                value={densityNeighbors}
                onChange={(e) => setDensityNeighbors(Number(e.target.value))}
              />
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
          <div className="pc-filter-block">
            <strong>{tr("pcMenuFilterGround")}</strong>
            <label>
              cell = {groundCell.toFixed(2)}m
              <input
                type="range"
                min={0.2}
                max={5}
                step={0.1}
                value={groundCell}
                onChange={(e) => setGroundCell(Number(e.target.value))}
              />
            </label>
            <label>
              offset = {groundOffset.toFixed(2)}m
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.05}
                value={groundOffset}
                onChange={(e) => setGroundOffset(Number(e.target.value))}
              />
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
      )}
    </div>
  );
}
