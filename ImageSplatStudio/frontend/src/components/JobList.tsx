import type { JobInfo, JobStatus } from "../types";

const STAGE_LABELS: Record<JobStatus, string> = {
  pending: "Chờ",
  uploading: "Upload",
  preprocessing: "Tiền xử lý",
  colmap: "COLMAP",
  meshing: "Tạo mesh",
  training: "Huấn luyện 3DGS",
  exporting: "Xuất file",
  completed: "Hoàn tất",
  failed: "Lỗi",
  cancelled: "Đã hủy",
};

const TYPE_LABELS: Record<string, string> = {
  images: "Ảnh → Splat",
  pointcloud: "PC → 3D GS",
};

interface JobListProps {
  jobs: JobInfo[];
  selectedId: string | null;
  onSelect: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

export function JobList({ jobs, selectedId, onSelect, onDelete }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="panel job-list empty">
        <h3>Dự án</h3>
        <p className="muted">Chưa có job nào.</p>
      </div>
    );
  }

  return (
    <div className="panel job-list">
      <h3>Dự án ({jobs.length})</h3>
      <ul>
        {jobs.map((job) => (
          <li
            key={job.job_id}
            className={selectedId === job.job_id ? "selected" : ""}
            onClick={() => onSelect(job.job_id)}
          >
            <div className="job-row-top">
              <strong>{job.name}</strong>
              <span className={`badge badge-${job.status}`}>
                {STAGE_LABELS[job.status]}
              </span>
            </div>
            <div className="job-meta">
              <span className="job-type-tag">{TYPE_LABELS[job.job_type] ?? job.job_type}</span>
              · {Math.round(job.progress.percent)}%
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${job.progress.percent}%` }}
              />
            </div>
            <p className="job-message">{job.progress.message}</p>
            <button
              type="button"
              className="button-link danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(job.job_id);
              }}
            >
              Xóa
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
