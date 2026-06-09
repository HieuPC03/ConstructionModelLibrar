import { useI18n } from "../i18n/I18nProvider";
import type { JobInfo } from "../types";
import {
  exportPackageUrl,
  fbxDownloadUrl,
  safeExportName,
  splatDownloadUrl,
  triggerDownload,
} from "../utils/export";

interface ExportBarProps {
  job: JobInfo;
}

export function ExportBar({ job }: ExportBarProps) {
  const { tr } = useI18n();
  const baseName = safeExportName(job.name, job.job_id);

  return (
    <div className="export-bar">
      <div className="export-bar-info">
        <span className="export-badge">{tr("exportReady")}</span>
        <span className="muted export-hint">{tr("exportHint")}</span>
      </div>
      <div className="export-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => triggerDownload(splatDownloadUrl(job), `${baseName}.splat`)}
        >
          {tr("exportSplat")}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => triggerDownload(fbxDownloadUrl(job), `${baseName}.fbx`)}
        >
          {tr("exportFbx")}
        </button>
        <button
          type="button"
          className="button button-primary export-zip-btn"
          onClick={() => triggerDownload(exportPackageUrl(job), `${baseName}-export.zip`)}
        >
          {tr("exportPackage")}
        </button>
      </div>
    </div>
  );
}
