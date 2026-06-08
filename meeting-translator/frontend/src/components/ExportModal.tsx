import { useEffect, useState } from "react";
import {
  exportTranscript,
  exportTranscriptSegments,
  exportVideoToFolder,
} from "../api";
import { useAppSettings } from "../AppSettingsContext";
import type { ExportPayload } from "../ExportContext";
import { friendlyMediaError } from "../utils/mediaRecorder";

type ExportFormat = "txt" | "video";

type Props = {
  payload: ExportPayload;
  onClose: () => void;
};

export default function ExportModal({ payload, onClose }: Props) {
  const { tr, recordingsDir, settings } = useAppSettings();
  const [saveDir, setSaveDir] = useState("");
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [exporting, setExporting] = useState(false);

  const defaultDir = recordingsDir || settings?.recordings_dir_active || "";
  const canExportVideo = Boolean(payload.sessionId);
  const hasTxtContent = payload.isTranslate
    ? payload.utterances.length > 0
    : payload.hasTranscriptContent;

  useEffect(() => {
    setSaveDir(defaultDir);
    setFormat(hasTxtContent ? "txt" : canExportVideo ? "video" : "txt");
  }, [defaultDir, hasTxtContent, canExportVideo]);

  const pickFolder = async () => {
    const dir = await window.desktopApp?.pickFolder?.();
    if (dir) setSaveDir(dir);
  };

  const handleExport = async () => {
    const dir = saveDir.trim();
    if (!dir) {
      payload.setStatus(`error:${tr("exportNeedDir")}`);
      return;
    }
    if (format === "txt" && !hasTxtContent) return;
    if (format === "video" && !payload.sessionId) return;

    setExporting(true);
    try {
      let msg: string;
      if (format === "video" && payload.sessionId) {
        msg = await exportVideoToFolder(
          payload.sessionId,
          dir,
          `recording-${Date.now()}.mp4`
        );
      } else if (payload.isTranslate) {
        msg = await exportTranscript(
          payload.utterances,
          dir,
          `transcript-${Date.now()}.txt`
        );
      } else {
        msg = await exportTranscriptSegments(
          payload.transcriptSegments,
          dir,
          `transcript-${Date.now()}.txt`
        );
      }
      payload.setStatus(`saved:${msg}`);
      onClose();
    } catch (e) {
      payload.setStatus(`error:${friendlyMediaError(e)}`);
    } finally {
      setExporting(false);
    }
  };

  const exportDisabled =
    exporting ||
    !saveDir.trim() ||
    (format === "txt" && !hasTxtContent) ||
    (format === "video" && !canExportVideo);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => !exporting && onClose()}
    >
      <div
        className="modal-dialog export-modal"
        role="dialog"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="export-modal-title">{tr("exportData")}</h3>
        <p className="modal-hint">{tr("exportModalHint")}</p>

        <label className="export-modal-field">
          {tr("exportSaveFolder")}
          <div className="export-modal-path">
            <input
              type="text"
              value={saveDir}
              onChange={(e) => setSaveDir(e.target.value)}
              placeholder={defaultDir || "AppData"}
            />
            {window.desktopApp?.pickFolder && (
              <button
                type="button"
                className="secondary"
                onClick={() => void pickFolder()}
                disabled={exporting}
              >
                {tr("pick")}
              </button>
            )}
          </div>
        </label>

        <label className="export-modal-field">
          {tr("exportFormat")}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            disabled={exporting}
          >
            <option value="txt" disabled={!hasTxtContent}>
              {tr("exportAsTxt")}
            </option>
            <option value="video" disabled={!canExportVideo}>
              {tr("exportAsVideo")}
            </option>
          </select>
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={exporting}
          >
            {tr("wordLookupClose")}
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exportDisabled}
          >
            {exporting ? "…" : tr("exportConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
