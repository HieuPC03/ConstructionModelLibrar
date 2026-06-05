import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import type { JobInfo, JobStatus } from "../types";
import { exportPackageUrl, safeExportName, triggerDownload } from "../utils/export";

const STAGE_KEYS: Record<JobStatus, TranslationKey> = {
  pending: "stagePending",
  uploading: "stageUploading",
  preprocessing: "stagePreprocessing",
  colmap: "stageColmap",
  meshing: "stageMeshing",
  training: "stageTraining",
  exporting: "stageExporting",
  completed: "stageCompleted",
  failed: "stageFailed",
  cancelled: "stageCancelled",
};

interface JobListProps {
  jobs: JobInfo[];
  selectedId: string | null;
  onSelect: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

export function JobList({ jobs, selectedId, onSelect, onDelete }: JobListProps) {
  const { tr } = useI18n();

  if (jobs.length === 0) {
    return (
      <div className="panel job-list empty">
        <h3>{tr("projects")}</h3>
        <p className="muted">{tr("noProjects")}</p>
      </div>
    );
  }

  return (
    <div className="panel job-list">
      <h3>
        {tr("projects")} ({jobs.length})
      </h3>
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
                {tr(STAGE_KEYS[job.status])}
              </span>
            </div>
            <div className="job-meta">
              <span className="job-type-tag">
                {job.job_type === "images" ? tr("typeImages") : tr("typePointcloud")}
              </span>
              · {Math.round(job.progress.percent)}%
              {job.image_count > 0 && ` · ${job.image_count} imgs`}
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${job.progress.percent}%` }}
              />
            </div>
            <p className="job-message">{job.progress.message}</p>
            <div className="job-actions">
              {job.status === "completed" && (
                <button
                  type="button"
                  className="button-link export-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerDownload(
                      exportPackageUrl(job),
                      `${safeExportName(job.name, job.job_id)}-export.zip`,
                    );
                  }}
                >
                  {tr("exportQuick")}
                </button>
              )}
              <button
                type="button"
                className="button-link danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(job.job_id);
                }}
              >
                {tr("deleteJob")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
