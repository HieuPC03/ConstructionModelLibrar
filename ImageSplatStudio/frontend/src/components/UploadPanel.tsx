import { useCallback, useEffect, useRef, useState } from "react";
import { fileKey, isImageFile } from "../utils/files";

interface UploadPanelProps {
  onSubmit: (name: string, files: File[], demo: boolean) => Promise<void>;
  busy: boolean;
  demoMode: boolean;
}

interface FilePreview {
  key: string;
  file: File;
  url: string;
}

export function UploadPanel({ onSubmit, busy, demoMode }: UploadPanelProps) {
  const [name, setName] = useState("");
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [demo, setDemo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef(previews);
  previewsRef.current = previews;

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(isImageFile);
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
  }, []);

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
    await onSubmit(name.trim() || "Mô hình mới", files, demo);
    setName("");
    clearFiles();
    setDemo(false);
  };

  const fileCount = previews.length;
  const canSubmit = demo || fileCount >= 3;

  return (
    <form className="panel upload-panel" onSubmit={handleSubmit}>
      <h2>Tạo mô hình 3D từ ảnh</h2>
      <p className="muted">
        Upload 20–100 ảnh chụp quanh vật thể/cảnh (góc overlap ~60%). Hệ thống chạy COLMAP +
        3D Gaussian Splatting.
      </p>

      {demoMode && (
        <div className="banner banner-warn">
          Máy chủ không có GPU — huấn luyện thật cần CUDA. Bạn vẫn có thể thử{" "}
          <strong>Demo nhanh</strong> để xem viewer.
        </div>
      )}

      <label className="field">
        <span>Tên dự án</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Nhà máy Zone A"
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
        <p>Kéo thả ảnh vào đây hoặc</p>
        <label className="button button-secondary">
          Chọn ảnh
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff"
            multiple
            hidden
            disabled={busy}
            onChange={handleInputChange}
          />
        </label>
        <p className="file-count">
          {fileCount > 0 ? `${fileCount} ảnh đã chọn` : "Chưa chọn ảnh nào"}
        </p>
      </div>

      {fileCount > 0 && (
        <div className="preview-section">
          <div className="preview-header">
            <span>Ảnh đã chọn</span>
            <button
              type="button"
              className="button-link danger"
              onClick={clearFiles}
              disabled={busy}
            >
              Xóa tất cả
            </button>
          </div>
          <div className="preview-grid">
            {previews.map((preview) => (
              <div key={preview.key} className="preview-item">
                <img src={preview.url} alt={preview.file.name} loading="lazy" />
                <button
                  type="button"
                  className="preview-remove"
                  title="Xóa ảnh"
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
        <span>Demo nhanh (không cần ảnh — xem thử viewer)</span>
      </label>

      <button className="button button-primary" type="submit" disabled={busy || !canSubmit}>
        {busy ? "Đang tạo..." : "Bắt đầu reconstruction"}
      </button>

      {!demo && fileCount > 0 && fileCount < 3 && (
        <p className="error-text">Cần ít nhất 3 ảnh (khuyến nghị ≥ 20).</p>
      )}
    </form>
  );
}
