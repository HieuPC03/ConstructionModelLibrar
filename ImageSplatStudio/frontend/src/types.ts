export type JobStatus =
  | "pending"
  | "uploading"
  | "preprocessing"
  | "colmap"
  | "meshing"
  | "training"
  | "exporting"
  | "completed"
  | "failed"
  | "cancelled";

export type JobType = "images" | "pointcloud";
export type OutputFormat = "splat" | "mesh";

export interface JobProgress {
  stage: JobStatus;
  percent: number;
  message: string;
}

export interface JobInfo {
  job_id: string;
  name: string;
  job_type: JobType;
  output_format: OutputFormat;
  status: JobStatus;
  progress: JobProgress;
  image_count: number;
  created_at: string;
  updated_at: string;
  output_url?: string | null;
  error?: string | null;
  demo?: boolean;
  mesh_method?: string | null;
  training_quality?: string | null;
}

export interface HealthInfo {
  status: string;
  gpu_available: boolean;
  colmap_available: boolean;
  open3d_available: boolean;
  inria_3dgs_available?: boolean;
  demo_mode: boolean;
}

export type TrainingQuality = "preview" | "standard";

export type AppMode = "images" | "pointcloud";
