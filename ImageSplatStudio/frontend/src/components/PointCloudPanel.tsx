import { useRef, useState } from "react";
import { formatFileSize, isPointCloudFile } from "../utils/pointcloud";

interface PointCloudPanelProps {
  onSubmit: (
    name: string,
    file: File | null,
    demo: boolean,
    method: "poisson" | "bpa",
  ) => Promise<void>;
  busy: boolean;
  open3dAvailable: boolean;
}

export function PointCloudPanel({
  onSubmit,
  busy,
  open3dAvailable,
}: PointCloudPanelProps) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [demo, setDemo] = useState(false);
  const [method, setMethod] = useState<"poisson" | "bpa">("poisson");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (incoming: FileList | File[]) => {
    const picked = Array.from(incoming).find(isPointCloudFile);
    if (picked) setFile(picked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(name.trim() || "Point Cloud", demo ? null : file, demo, method);
    setName("");
    setFile(null);
    setDemo(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const canSubmit = demo || file !== null;

  return (
    <form className="panel upload-panel" onSubmit={handleSubmit}>
      <h2>Point Cloud → Mesh 3D</h2>
      <p className="muted">
        Upload file point cloud (.ply, .pcd, .xyz, .las...) — hệ thống dùng Open3D Poisson /
        Ball Pivoting để tạo mesh 3D.
      </p>

      {!open3dAvailable && (
        <div className="banner banner-warn">
          Open3D chưa sẵn sàng trên server. Cài: <code>pip install open3d</code>
        </div>
      )}

      <label className="field">
        <span>Tên dự án</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Scan nhà xưởng"
          disabled={busy}
        />
      </label>

      <label className="field">
        <span>Phương pháp reconstruction</span>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as "poisson" | "bpa")}
          disabled={busy}
        >
          <option value="poisson">Poisson (mượt, khuyến nghị)</option>
          <option value="bpa">Ball Pivoting (chi tiết cao)</option>
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
        <p>Kéo thả point cloud hoặc</p>
        <label className="button button-secondary">
          Chọn file
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
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Xóa
            </button>
          </div>
        ) : (
          <p className="file-count">Chưa chọn file</p>
        )}
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => setDemo(e.target.checked)}
          disabled={busy}
        />
        <span>Demo (dùng point cloud mẫu)</span>
      </label>

      <button
        className="button button-primary"
        type="submit"
        disabled={busy || !canSubmit || !open3dAvailable}
      >
        {busy ? "Đang xử lý..." : "Tạo mesh 3D"}
      </button>
    </form>
  );
}
