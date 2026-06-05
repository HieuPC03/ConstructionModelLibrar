export type JobStatus =
  | "pending"
  | "uploading"
  | "preprocessing"
  | "colmap"
  | "training"
  | "exporting"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobProgress {
  stage: JobStatus;
  percent: number;
  message: string;
}

export interface JobInfo {
  job_id: string;
  name: string;
  status: JobStatus;
  progress: JobProgress;
  image_count: number;
  created_at: string;
  updated_at: string;
  output_url?: string | null;
  error?: string | null;
  demo?: boolean;
}

export interface HealthInfo {
  status: string;
  gpu_available: boolean;
  colmap_available: boolean;
  demo_mode: boolean;
}
