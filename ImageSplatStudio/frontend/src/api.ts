import type { HealthInfo, JobInfo } from "./types";

const API = "/api";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthInfo> {
  return parseJson(await fetch(`${API}/health`));
}

export async function fetchJobs(): Promise<JobInfo[]> {
  return parseJson(await fetch(`${API}/jobs`));
}

export async function fetchJob(jobId: string): Promise<JobInfo> {
  return parseJson(await fetch(`${API}/jobs/${jobId}`));
}

export async function createJob(
  name: string,
  images: File[],
  demo: boolean,
): Promise<{ job_id: string; message: string }> {
  const form = new FormData();
  form.append("name", name);
  form.append("demo", String(demo));
  for (const file of images) {
    form.append("images", file);
  }
  return parseJson(
    await fetch(`${API}/jobs`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function createPointCloudJob(
  name: string,
  files: File[],
  demo: boolean,
  method: "luma" | "standard",
): Promise<{ job_id: string; message: string }> {
  const form = new FormData();
  form.append("name", name);
  form.append("demo", String(demo));
  form.append("method", method);
  for (const file of files) {
    form.append("pointcloud", file);
  }
  return parseJson(
    await fetch(`${API}/pointcloud-jobs`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function deleteJob(jobId: string): Promise<void> {
  await parseJson(await fetch(`${API}/jobs/${jobId}`, { method: "DELETE" }));
}

export interface PointCloudPreviewData {
  total_points: number;
  preview_count: number;
  preview_fraction?: number;
  file_count?: number;
  format: string;
  positions: [number, number, number][];
  colors?: [number, number, number][];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
}

export async function previewPointClouds(files: File[]): Promise<PointCloudPreviewData> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  return parseJson(
    await fetch(`${API}/pointcloud-preview`, {
      method: "POST",
      body: form,
    }),
  );
}

/** @deprecated use previewPointClouds */
export async function previewPointCloud(file: File): Promise<PointCloudPreviewData> {
  return previewPointClouds([file]);
}

export function modelUrl(job: JobInfo): string {
  if (job.output_url) {
    return job.output_url.startsWith("http")
      ? job.output_url
      : `${window.location.origin}${job.output_url}`;
  }
  if (job.output_format === "mesh") {
    return `${API}/jobs/${job.job_id}/model.obj`;
  }
  return `${API}/jobs/${job.job_id}/model.splat`;
}
