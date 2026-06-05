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

export async function deleteJob(jobId: string): Promise<void> {
  await parseJson(await fetch(`${API}/jobs/${jobId}`, { method: "DELETE" }));
}

export function modelUrl(jobId: string): string {
  return `${API}/jobs/${jobId}/model.splat`;
}
