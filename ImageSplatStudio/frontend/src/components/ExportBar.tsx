import { useI18n } from "../i18n/I18nProvider";
import type { JobInfo } from "../types";
import { exportPackageUrl, safeExportName, splatDownloadUrl, triggerDownload } from "../utils/export";

interface ExportBarProps {
  job: JobInfo;
}

export function ExportBar({ job }: ExportBarProps) {
  const { tr } = useI18n();
  const baseName = safeExportName(job.name, job.job_id);

  const handleDownloadSplat = () => {
    triggerDownload(splatDownloadUrl(job), `${baseName}.splat`);
  };

  const handleDownloadPackage = () => {
    triggerDownload(exportPackageUrl(job), `${baseName}-export.zip`);
  };

  return (
    <div className="export-bar">
      <div className="export-bar-info">
        <span className="export-badge">{tr("exportReady")}</span>
        <span className="muted export-hint">{tr("exportHint")}</span>
      </div>
      <div className="export-actions">
        <button type="button" className="button button-secondary" onClick={handleDownloadSplat}>
          {tr("exportSplat")}
        </button>
        <button type="button" className="button button-primary export-zip-btn" onClick={handleDownloadPackage}>
          {tr("exportPackage")}
        </button>
      </div>
    </div>
  );
}
