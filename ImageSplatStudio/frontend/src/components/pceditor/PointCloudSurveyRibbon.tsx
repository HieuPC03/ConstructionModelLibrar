import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import {
  editorComputeVolume,
  editorConfigureGrid,
  editorFetchContours,
  type EditorProperties,
} from "../../api/editor";
import { logConsole } from "../../utils/consoleLog";
import type { ContourData, VolumeResult } from "../../utils/editorTools";

interface PointCloudSurveyRibbonProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  gridCellSize: number;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
  onContoursReady: (data: ContourData) => void;
  onVolumeResult: (result: VolumeResult) => void;
  onStartDensityRegion: () => void;
}

export function PointCloudSurveyRibbon({
  sessionId,
  properties,
  gridCellSize,
  onUpdated,
  onRefreshPreview,
  onError,
  onContoursReady,
  onVolumeResult,
  onStartDensityRegion,
}: PointCloudSurveyRibbonProps) {
  const { tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [contourInterval, setContourInterval] = useState(1.0);
  const [baseZ, setBaseZ] = useState(() => {
    const mn = properties?.bounds.min[2];
    return mn != null ? mn.toFixed(2) : "0";
  });

  const disabled = !sessionId || busy;
  const hasGrid = !!properties?.grid.has_data;

  const run = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    if (!sessionId) return null;
    setBusy(true);
    try {
      const result = await fn();
      logConsole(label, "success");
      return result;
    } catch (e: unknown) {
      onError(String(e));
      logConsole(`${label}: ${String(e)}`, "error");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createGridData = async () => {
    if (!sessionId) return;
    await run(tr("surveyCreateGrid"), async () => {
      const props = await editorConfigureGrid(sessionId, {
        enabled: true,
        cell_size: gridCellSize,
        create_data: true,
      });
      onUpdated(props);
      onRefreshPreview();
      return props;
    });
  };

  return (
    <div className="pc-survey-ribbon">
      <div className="pc-process-row">
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("surveyGroupGrid")}</span>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={() => void createGridData()}
          >
            {tr("surveyCreateGrid")}
          </button>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled || !hasGrid}
            onClick={async () => {
              if (!sessionId) return;
              const data = await run(tr("surveyContours"), () =>
                editorFetchContours(sessionId, contourInterval),
              );
              if (data) onContoursReady(data);
            }}
          >
            {tr("surveyContours")}
          </button>
          <label className="pc-process-inline">
            ΔZ={contourInterval.toFixed(1)}m
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={contourInterval}
              onChange={(e) => setContourInterval(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("surveyGroupVolume")}</span>
          <label className="pc-process-inline">
            {tr("surveyBaseZ")}
            <input
              type="number"
              className="pc-survey-input"
              step={0.01}
              value={baseZ}
              onChange={(e) => setBaseZ(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="pc-process-btn pc-process-accent"
            disabled={disabled || !hasGrid}
            onClick={async () => {
              if (!sessionId) return;
              const props = await run(tr("surveyVolume"), () =>
                editorComputeVolume(sessionId, Number(baseZ)),
              );
              if (props?.volume_result) {
                onUpdated(props);
                onVolumeResult(props.volume_result);
              }
            }}
          >
            {tr("surveyVolume")}
          </button>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("surveyGroupAnalysis")}</span>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled}
            onClick={onStartDensityRegion}
          >
            {tr("surveyDensity")}
          </button>
        </div>
      </div>

      {properties?.volumes && properties.volumes.length > 0 && (
        <div className="pc-survey-volumes">
          <strong>{tr("surveyVolumeHistory")}</strong>
          {properties.volumes.slice(-3).map((v) => (
            <span key={v.id} className="pc-survey-vol-item">
              Z₀={v.base_z.toFixed(2)} · {tr("surveyCut")}={v.cut_m3.toFixed(1)} ·{" "}
              {tr("surveyFill")}={v.fill_m3.toFixed(1)} · Δ={v.net_m3.toFixed(1)} m³
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
