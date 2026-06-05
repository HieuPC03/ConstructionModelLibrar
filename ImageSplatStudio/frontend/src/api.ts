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

export interface PointCloudPreviewMeta {
  total_points: number;
  preview_count: number;
  preview_percent?: number;
  preview_fraction?: number;
  preview_session_id?: string;
  file_count?: number;
  format: string;
  has_colors?: boolean;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
}

export interface PointCloudPreviewGeometry {
  count: number;
  positions: Float32Array;
  colors: Uint8Array | null;
}

const GEOMETRY_MAGIC = 0x43505349; // "ISPC" little-endian

export function decodePreviewGeometry(buffer: ArrayBuffer): PointCloudPreviewGeometry {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== GEOMETRY_MAGIC) {
    throw new Error("Invalid preview geometry format");
  }
  const count = view.getUint32(4, true);
  const hasColors = view.getUint8(8) === 1;
  const posOffset = 12;
  const positions = new Float32Array(buffer, posOffset, count * 3);
  let colors: Uint8Array | null = null;
  if (hasColors) {
    const colorOffset = posOffset + count * 3 * 4;
    colors = new Uint8Array(buffer, colorOffset, count * 3);
  }
  return { count, positions, colors };
}

export async function previewPointCloudMeta(
  files: File[],
  percent = 20,
  sessionId?: string,
): Promise<PointCloudPreviewMeta> {
  const form = new FormData();
  form.append("percent", String(percent));
  if (sessionId) {
    form.append("session_id", sessionId);
  } else {
    for (const file of files) {
      form.append("files", file);
    }
  }
  return parseJson(
    await fetch(`${API}/pointcloud-preview`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function fetchPreviewGeometry(
  sessionId: string,
  percent: number,
): Promise<PointCloudPreviewGeometry> {
  const response = await fetch(
    `${API}/pointcloud-preview/${encodeURIComponent(sessionId)}/geometry?percent=${percent}`,
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  const buffer = await response.arrayBuffer();
  return decodePreviewGeometry(buffer);
}

/** Load preview metadata + binary geometry */
export async function previewPointClouds(
  files: File[],
  percent = 20,
  sessionId?: string,
): Promise<PointCloudPreviewMeta & PointCloudPreviewGeometry> {
  const meta = await previewPointCloudMeta(files, percent, sessionId);
  const sid = meta.preview_session_id;
  if (!sid) {
    throw new Error("Missing preview session");
  }
  const geometry = await fetchPreviewGeometry(sid, percent);
  return { ...meta, ...geometry };
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
