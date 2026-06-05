import { useCallback, useState } from "react";

interface UploadPanelProps {
  onSubmit: (name: string, files: File[], demo: boolean) => Promise<void>;
  busy: boolean;
  demoMode: boolean;
}

export function UploadPanel({ onSubmit, busy, demoMode }: UploadPanelProps) {
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [demo, setDemo] = useState(false);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name + f.size, f]));
      for (const f of list) map.set(f.name + f.size, f);
      return Array.from(map.values());
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(name.trim() || "Mô hình mới", files, demo);
    setName("");
    setFiles([]);
    setDemo(false);
  };

  const canSubmit = demo || files.length >= 3;

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
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </label>
        <p className="file-count">{files.length} ảnh đã chọn</p>
      </div>

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

      {!demo && files.length > 0 && files.length < 3 && (
        <p className="error-text">Cần ít nhất 3 ảnh (khuyến nghị ≥ 20).</p>
      )}
    </form>
  );
}
