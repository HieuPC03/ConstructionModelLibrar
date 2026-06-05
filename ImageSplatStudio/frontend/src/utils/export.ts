import type { JobInfo } from "../types";

const API = "/api";

function downloadUrl(path: string): string {
  return path.startsWith("http") ? path : `${window.location.origin}${path}`;
}

export function splatDownloadUrl(job: JobInfo): string {
  return downloadUrl(`${API}/jobs/${job.job_id}/model.splat`);
}

export function exportPackageUrl(job: JobInfo): string {
  return downloadUrl(`${API}/jobs/${job.job_id}/export.zip`);
}

export function fbxDownloadUrl(job: JobInfo): string {
  return downloadUrl(`${API}/jobs/${job.job_id}/model.fbx`);
}

/** Trigger browser download for a URL */
export function triggerDownload(url: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (filename) anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function safeExportName(name: string, jobId: string): string {
  const cleaned = name.trim().replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").slice(0, 80);
  return cleaned || jobId;
}
