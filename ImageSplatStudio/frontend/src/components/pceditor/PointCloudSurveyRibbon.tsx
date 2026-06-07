import { useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import {
  editorEvaluateDeviation,
  editorImportCsvSurvey,
  type DeviationHeatmap,
  type EditorProperties,
} from "../../api/editor";
import { logConsole } from "../../utils/consoleLog";

interface PointCloudSurveyRibbonProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  gridCellSize: number;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
  onContoursReady: (data: import("../../utils/editorTools").ContourData) => void;
  onVolumeResult: (result: import("../../utils/editorTools").VolumeResult) => void;
  onDeviationReady: (data: DeviationHeatmap) => void;
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
  onDeviationReady,
  onStartDensityRegion,
}: PointCloudSurveyRibbonProps) {
  const { tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [contourInterval] = useState(1.0);
  const [baseZ] = useState(() => {
    const mn = properties?.bounds.min[2];
    return mn != null ? mn.toFixed(2) : "0";
  });
  const [designZ, setDesignZ] = useState(() => baseZ);
  const [tolOk] = useState(0.05);
  const [tolWarn] = useState(0.15);
  const [csvSkipRows] = useState(2);
  const [csvZFlip, setCsvZFlip] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

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
    const { editorConfigureGrid } = await import("../../api/editor");
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

  const handleCsvFile = async (file: File) => {
    if (!sessionId) return;
    const text = await file.text();
    const props = await run(tr("dekiCsvImport"), () =>
      editorImportCsvSurvey(sessionId, {
        csv_text: text,
        skip_header_rows: csvSkipRows,
        z_flip: csvZFlip,
      }),
    );
    if (props) {
      onUpdated(props);
      onRefreshPreview();
    }
  };

  return (
    <div className="pc-survey-ribbon">
      <div className="pc-process-row">
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("surveyGroupGrid")}</span>
          <button type="button" className="pc-process-btn" disabled={disabled} onClick={() => void createGridData()}>
            {tr("surveyCreateGrid")}
          </button>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled || !hasGrid}
            onClick={async () => {
              if (!sessionId) return;
              const { editorFetchContours } = await import("../../api/editor");
              const data = await run(tr("surveyContours"), () => editorFetchContours(sessionId, contourInterval));
              if (data) onContoursReady(data);
            }}
          >
            {tr("surveyContours")}
          </button>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("dekiGroupTitle")}</span>
          <label className="pc-process-inline">
            {tr("dekiDesignZ")}
            <input type="number" className="pc-survey-input" step={0.01} value={designZ} onChange={(e) => setDesignZ(e.target.value)} />
          </label>
          <button
            type="button"
            className="pc-process-btn pc-process-accent"
            disabled={disabled || !hasGrid}
            onClick={async () => {
              if (!sessionId) return;
              const data = await run(tr("dekiEvaluate"), () =>
                editorEvaluateDeviation(sessionId, Number(designZ), tolOk, tolWarn),
              );
              if (data) {
                onDeviationReady(data);
                const props = await import("../../api/editor").then((m) => m.fetchEditorProperties(sessionId));
                onUpdated(await props);
              }
            }}
          >
            {tr("dekiEvaluate")}
          </button>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("surveyGroupVolume")}</span>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled || !hasGrid}
            onClick={async () => {
              if (!sessionId) return;
              const { editorComputeVolume } = await import("../../api/editor");
              const props = await run(tr("surveyVolume"), () => editorComputeVolume(sessionId, Number(baseZ)));
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
          <span className="pc-ribbon-label">{tr("dekiCsvImport")}</span>
          <input ref={csvRef} type="file" accept=".csv,.txt" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleCsvFile(f);
            e.target.value = "";
          }} />
          <button type="button" className="pc-process-btn" disabled={disabled} onClick={() => csvRef.current?.click()}>
            {tr("dekiCsvImport")}
          </button>
          <label className="pc-process-inline">
            <input type="checkbox" checked={csvZFlip} onChange={(e) => setCsvZFlip(e.target.checked)} />
            Z↕
          </label>
        </div>

        <div className="pc-process-group">
          <button type="button" className="pc-process-btn" disabled={disabled} onClick={onStartDensityRegion}>
            {tr("surveyDensity")}
          </button>
        </div>
      </div>

      {properties?.deviation_heatmap?.stats && (
        <div className="pc-survey-volumes">
          <strong>{tr("dekiHeatmap")}</strong>
          <span>RMSE={properties.deviation_heatmap.stats.rmse_m.toFixed(3)}m</span>
          <span>{tr("dekiWithinOk")}={properties.deviation_heatmap.stats.within_ok_pct.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
