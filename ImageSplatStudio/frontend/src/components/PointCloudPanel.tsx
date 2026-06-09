import { useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { formatFileSize, isPointCloudFile } from "../utils/pointcloud";

interface PointCloudPanelProps {
  onSubmit: (
    name: string,
    files: File[],
    demo: boolean,
    method: "luma" | "standard",
  ) => Promise<void>;
  onFilesChange?: (files: File[]) => void;
  busy: boolean;
  open3dAvailable: boolean;
}

export function PointCloudPanel({
  onSubmit,
  onFilesChange,
  busy,
  open3dAvailable,
}: PointCloudPanelProps) {
  const { tr } = useI18n();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [demo, setDemo] = useState(false);
  const [method, setMethod] = useState<"luma" | "standard">("luma");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFiles = (next: File[]) => {
    setFiles(next);
    onFilesChange?.(next);
  };

  const handleFile = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(isPointCloudFile);
    if (accepted.length === 0) return;
    const map = new Map(files.map((f) => [`${f.name}-${f.size}`, f]));
    for (const f of accepted) {
      map.set(`${f.name}-${f.size}`, f);
    }
    updateFiles(Array.from(map.values()));
  };

  const removeFile = (key: string) => {
    updateFiles(files.filter((f) => `${f.name}-${f.size}` !== key));
  };

  const clearFiles = () => {
    updateFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(name.trim() || "Point Cloud", demo ? [] : files, demo, method);
    setName("");
    clearFiles();
    setDemo(false);
  };

  const canSubmit = demo || files.length > 0;

  return (
    <form className="panel upload-panel" onSubmit={handleSubmit}>
      <h2>{tr("pcTitle")}</h2>
      <p className="muted">{tr("pcDesc")}</p>

      {!open3dAvailable && (
        <div className="banner banner-warn">{tr("pcOpen3dWarn")}</div>
      )}

      <label className="field">
        <span>{tr("projectName")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr("pcNamePlaceholder")}
          disabled={busy}
        />
      </label>

      <label className="field">
        <span>{tr("qualityLabel")}</span>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as "luma" | "standard")}
          disabled={busy}
        >
          <option value="luma">{tr("qualityLuma")}</option>
          <option value="standard">{tr("qualityStandard")}</option>
        </select>
      </label>

      <div
        className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files);
        }}
      >
        <p>{tr("dropPc")}</p>
        <label className="button button-secondary">
          {tr("chooseFile")}
          <input
            ref={inputRef}
            type="file"
            accept=".ply,.pcd,.xyz,.pts,.las,.laz,.obj,.txt,.fbx,.dxf,.dwg,.xml"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) handleFile(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <div className="pc-file-list">
            <p className="file-count">
              {files.length} {tr("pcFilesSelected")}
            </p>
            <ul>
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`}>
                  <span>
                    {f.name} · {formatFileSize(f.size)}
                  </span>
                  <button
                    type="button"
                    className="button-link danger"
                    onClick={() => removeFile(`${f.name}-${f.size}`)}
                    disabled={busy}
                  >
                    {tr("remove")}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="button-link danger" onClick={clearFiles} disabled={busy}>
              {tr("clearAll")}
            </button>
          </div>
        ) : (
          <p className="file-count">{tr("noPcFile")}</p>
        )}
        <p className="muted pc-formats-hint">{tr("pcFormatsHint")}</p>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => setDemo(e.target.checked)}
          disabled={busy}
        />
        <span>{tr("pcDemo")}</span>
      </label>

      <button
        className="button button-primary"
        type="submit"
        disabled={busy || !canSubmit || !open3dAvailable}
      >
        {busy ? tr("pcSubmitting") : tr("pcSubmit")}
      </button>
    </form>
  );
}
