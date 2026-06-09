import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { fileKey, isHeicFile, isSupportedImageFile } from "../utils/files";

interface UploadPanelProps {
  onSubmit: (
    name: string,
    files: File[],
    demo: boolean,
    trainingQuality: "preview" | "standard",
  ) => Promise<void>;
  busy: boolean;
  demoMode: boolean;
  inriaAvailable?: boolean;
}

interface FilePreview {
  key: string;
  file: File;
  url: string;
}

export function UploadPanel({ onSubmit, busy, demoMode, inriaAvailable }: UploadPanelProps) {
  const { tr } = useI18n();
  const [name, setName] = useState("");
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [demo, setDemo] = useState(false);
  const [trainingQuality, setTrainingQuality] = useState<"preview" | "standard">("standard");
  const [skipped, setSkipped] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef(previews);
  previewsRef.current = previews;

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      let skipCount = 0;
      const accepted: File[] = [];
      for (const file of Array.from(incoming)) {
        if (isHeicFile(file)) {
          skipCount += 1;
          continue;
        }
        if (isSupportedImageFile(file)) {
          accepted.push(file);
        } else {
          skipCount += 1;
        }
      }
      if (skipCount > 0) setSkipped((s) => s + skipCount);
      if (accepted.length === 0) return;

      setPreviews((prev) => {
        const map = new Map(prev.map((p) => [p.key, p]));
        for (const file of accepted) {
          const key = fileKey(file);
          if (!map.has(key)) {
            map.set(key, { key, file, url: URL.createObjectURL(file) });
          }
        }
        return Array.from(map.values());
      });
    },
    [],
  );

  const removeFile = useCallback((key: string) => {
    setPreviews((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.key !== key);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setPreviews((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url);
      return [];
    });
    setSkipped(0);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      for (const p of previewsRef.current) URL.revokeObjectURL(p.url);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = previews.map((p) => p.file);
    await onSubmit(name.trim() || "Mô hình mới", files, demo, trainingQuality);
    setName("");
    clearFiles();
    setDemo(false);
    setTrainingQuality("standard");
  };

  const fileCount = previews.length;
  const canSubmit = demo || fileCount >= 3;

  return (
    <form className="panel upload-panel" onSubmit={handleSubmit}>
      <h2>{tr("imgTitle")}</h2>
      <p className="muted">{tr("imgDesc")}</p>

      {demoMode && (
        <div className="banner banner-warn">{tr("imgGpuWarn")}</div>
      )}

      {inriaAvailable && !demoMode && (
        <div className="banner banner-ok">{tr("imgInriaReady")}</div>
      )}

      {!demo && !demoMode && (
        <label className="field">
          <span>{tr("imgTrainingQuality")}</span>
          <select
            value={trainingQuality}
            onChange={(e) => setTrainingQuality(e.target.value as "preview" | "standard")}
            disabled={busy}
          >
            <option value="preview">{tr("imgQualityPreview")}</option>
            <option value="standard">{tr("imgQualityStandard")}</option>
          </select>
          <p className="muted">{tr("imgQualityHint")}</p>
        </label>
      )}

      {skipped > 0 && (
        <div className="banner banner-warn">
          {skipped} {tr("unsupportedSkipped")}. {tr("imgHeicWarn")}
        </div>
      )}

      <label className="field">
        <span>{tr("projectName")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr("imgNamePlaceholder")}
          disabled={busy}
        />
      </label>

      <div
        className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <p>{tr("dropImages")}</p>
        <label className="button button-secondary">
          {tr("chooseImages")}
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,.gif,.bmp,image/jpeg,image/png,image/webp"
            multiple
            hidden
            disabled={busy}
            onChange={handleInputChange}
          />
        </label>
        <p className="file-count">
          {fileCount > 0 ? `${fileCount} ${tr("imagesSelected")}` : tr("noImages")}
        </p>
      </div>

      {fileCount > 0 && (
        <div className="preview-section">
          <div className="preview-header">
            <span>{tr("selectedImages")}</span>
            <button
              type="button"
              className="button-link danger"
              onClick={clearFiles}
              disabled={busy}
            >
              {tr("clearAll")}
            </button>
          </div>
          <div className="preview-grid">
            {previews.map((preview) => (
              <div key={preview.key} className="preview-item">
                <img src={preview.url} alt={preview.file.name} loading="lazy" />
                <button
                  type="button"
                  className="preview-remove"
                  title={tr("remove")}
                  onClick={() => removeFile(preview.key)}
                  disabled={busy}
                >
                  ×
                </button>
                <span className="preview-name" title={preview.file.name}>
                  {preview.file.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => setDemo(e.target.checked)}
          disabled={busy}
        />
        <span>{tr("imgDemo")}</span>
      </label>

      <button className="button button-primary" type="submit" disabled={busy || !canSubmit}>
        {busy ? tr("imgSubmitting") : tr("imgSubmit")}
      </button>

      {!demo && fileCount > 0 && fileCount < 3 && (
        <p className="error-text">{tr("imgMinError")}</p>
      )}
    </form>
  );
}
