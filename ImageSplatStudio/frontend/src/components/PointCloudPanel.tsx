import { useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { formatFileSize, isPointCloudFile } from "../utils/pointcloud";

interface PointCloudPanelProps {
  onSubmit: (
    name: string,
    file: File | null,
    demo: boolean,
    method: "luma" | "standard",
  ) => Promise<void>;
  onFileChange?: (file: File | null) => void;
  busy: boolean;
  open3dAvailable: boolean;
}

export function PointCloudPanel({
  onSubmit,
  onFileChange,
  busy,
  open3dAvailable,
}: PointCloudPanelProps) {
  const { tr } = useI18n();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [demo, setDemo] = useState(false);
  const [method, setMethod] = useState<"luma" | "standard">("luma");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (incoming: FileList | File[]) => {
    const picked = Array.from(incoming).find(isPointCloudFile);
    if (picked) {
      setFile(picked);
      onFileChange?.(picked);
    }
  };

  const clearFile = () => {
    setFile(null);
    onFileChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(name.trim() || "Point Cloud", demo ? null : file, demo, method);
    setName("");
    clearFile();
    setDemo(false);
  };

  const canSubmit = demo || file !== null;

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
            accept=".ply,.pcd,.xyz,.pts,.las,.laz,.obj,.txt"
            hidden
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) handleFile(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {file ? (
          <div className="pointcloud-file-info">
            <strong>{file.name}</strong>
            <span>{formatFileSize(file.size)}</span>
            <button
              type="button"
              className="button-link danger"
              onClick={clearFile}
              disabled={busy}
            >
              {tr("remove")}
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
