import { useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import {
  editorExportLasUrl,
  editorExportPlyUrl,
  editorExportTxtUrl,
  editorImportFiles,
  editorImportGeorefImages,
  editorMeshUrl,
  type EditorProperties,
} from "../../api/editor";
import { triggerDownload } from "../../utils/export";
import { logConsole } from "../../utils/consoleLog";
import { SUPPORTED_GEOREF_LABEL, SUPPORTED_POINTCLOUD_LABEL } from "../../utils/pointcloud";

interface PointCloudFileRibbonProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: (fitTarget?: { start_index: number; point_count: number }) => void;
  onError: (msg: string) => void;
}

export function PointCloudFileRibbon({
  sessionId,
  properties,
  onUpdated,
  onRefreshPreview,
  onError,
}: PointCloudFileRibbonProps) {
  const { tr } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const georefInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [georefBusy, setGeorefBusy] = useState(false);
  const [zFlip, setZFlip] = useState(false);
  const [exportFileIndex, setExportFileIndex] = useState<number | "all">("all");

  const disabled = !sessionId || busy;
  const files = properties?.files ?? [];

  const handleImport = async (fileList: FileList | null) => {
    if (!sessionId || !fileList?.length) return;
    setBusy(true);
    try {
      const props = await editorImportFiles(sessionId, Array.from(fileList), { z_flip: zFlip });
      onUpdated(props);
      onRefreshPreview(props.imported_file);
      const n = props.imported_count ?? 0;
      logConsole(`${tr("fileImportDone")}: +${n.toLocaleString()}`, "success");
    } catch (e: unknown) {
      onError(String(e));
      logConsole(`${tr("fileImport")}: ${String(e)}`, "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleGeorefImport = async (fileList: FileList | null) => {
    if (!sessionId || !fileList?.length) return;
    setGeorefBusy(true);
    try {
      const props = await editorImportGeorefImages(sessionId, Array.from(fileList));
      onUpdated(props);
      onRefreshPreview();
      const n = props.georef_imported_count ?? 0;
      logConsole(`${tr("fileGeorefImportDone")}: ${n}`, "success");
    } catch (e: unknown) {
      onError(String(e));
      logConsole(`${tr("fileGeorefImport")}: ${String(e)}`, "error");
    } finally {
      setGeorefBusy(false);
      if (georefInputRef.current) georefInputRef.current.value = "";
    }
  };

  const fileIndexParam = exportFileIndex === "all" ? undefined : exportFileIndex;

  const exportLas = () => {
    if (!sessionId) return;
    const name =
      exportFileIndex === "all"
        ? "pointcloud.las"
        : files[exportFileIndex]?.name.replace(/\.[^.]+$/, "") + ".las";
    triggerDownload(editorExportLasUrl(sessionId, fileIndexParam), name);
    logConsole(tr("pcMenuExportLas"), "info");
  };

  const exportTxt = () => {
    if (!sessionId) return;
    const name =
      exportFileIndex === "all"
        ? "pointcloud.txt"
        : files[exportFileIndex]?.name.replace(/\.[^.]+$/, "") + ".txt";
    triggerDownload(editorExportTxtUrl(sessionId, fileIndexParam), name);
    logConsole(tr("pcMenuExportTxt"), "info");
  };

  const exportPly = () => {
    if (!sessionId) return;
    const name =
      exportFileIndex === "all"
        ? "pointcloud.ply"
        : files[exportFileIndex]?.name.replace(/\.[^.]+$/, "") + ".ply";
    triggerDownload(editorExportPlyUrl(sessionId, fileIndexParam), name);
    logConsole(tr("fileExportPly"), "info");
  };

  const exportMesh = () => {
    if (!sessionId || !properties?.mesh) return;
    triggerDownload(editorMeshUrl(sessionId), "mesh.obj");
    logConsole(tr("fileExportMesh"), "info");
  };

  return (
    <div className="pc-process-ribbon pc-file-ribbon">
      <div className="pc-process-row">
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("fileGroupImport")}</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".ply,.pcd,.xyz,.pts,.las,.laz,.txt,.obj,.fbx,.dxf,.dwg,.xml,.landxml"
            className="pc-file-input-hidden"
            onChange={(e) => void handleImport(e.target.files)}
          />
          <button
            type="button"
            className="pc-process-btn pc-process-accent"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? tr("pcMenuWorking") : tr("fileImport")}
          </button>
          <label className="pc-process-inline pc-file-option">
            <input type="checkbox" checked={zFlip} onChange={(e) => setZFlip(e.target.checked)} />
            {tr("fileImportZFlip")}
          </label>
          <p className="pc-process-hint">
            {tr("fileFormatsHint")}: {SUPPORTED_POINTCLOUD_LABEL}
          </p>
          <p className="pc-process-hint">{tr("fileDwgHint")}</p>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("fileGroupGeoref")}</span>
          <input
            ref={georefInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.tif,.tiff,.pgw,.jgw,.tfw,.wld"
            className="pc-file-input-hidden"
            onChange={(e) => void handleGeorefImport(e.target.files)}
          />
          <button
            type="button"
            className="pc-process-btn"
            disabled={!sessionId || georefBusy}
            onClick={() => georefInputRef.current?.click()}
          >
            {georefBusy ? tr("pcMenuWorking") : tr("fileGeorefImport")}
          </button>
          <p className="pc-process-hint">
            {tr("fileGeorefHint")}: {SUPPORTED_GEOREF_LABEL}
          </p>
        </div>

        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("fileGroupExport")}</span>
          {files.length > 1 && (
            <select
              className="pc-ribbon-select"
              value={exportFileIndex === "all" ? "all" : String(exportFileIndex)}
              onChange={(e) =>
                setExportFileIndex(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">{tr("fileExportAll")}</option>
              {files.map((f, i) => (
                <option key={`${f.name}-${i}`} value={String(i)}>
                  {f.name} ({f.point_count.toLocaleString()})
                </option>
              ))}
            </select>
          )}
          <button type="button" className="pc-process-btn" disabled={disabled} onClick={exportLas}>
            {tr("pcMenuExportLas")}
          </button>
          <button type="button" className="pc-process-btn" disabled={disabled} onClick={exportTxt}>
            {tr("pcMenuExportTxt")}
          </button>
          <button type="button" className="pc-process-btn" disabled={disabled} onClick={exportPly}>
            {tr("fileExportPly")}
          </button>
          <button
            type="button"
            className="pc-process-btn"
            disabled={disabled || !properties?.mesh}
            onClick={exportMesh}
          >
            {tr("fileExportMesh")}
          </button>
        </div>
      </div>
    </div>
  );
}
