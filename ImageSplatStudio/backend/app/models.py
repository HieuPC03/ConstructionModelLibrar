from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobType(str, Enum):
    IMAGES = "images"
    POINTCLOUD = "pointcloud"


class OutputFormat(str, Enum):
    SPLAT = "splat"
    MESH = "mesh"


class JobStatus(str, Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    PREPROCESSING = "preprocessing"
    COLMAP = "colmap"
    MESHING = "meshing"
    TRAINING = "training"
    EXPORTING = "exporting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobCreateResponse(BaseModel):
    job_id: str
    message: str


class JobProgress(BaseModel):
    stage: JobStatus
    percent: float = Field(ge=0, le=100)
    message: str


class JobInfo(BaseModel):
    job_id: str
    name: str
    job_type: JobType = JobType.IMAGES
    output_format: OutputFormat = OutputFormat.SPLAT
    status: JobStatus
    progress: JobProgress
    image_count: int
    created_at: datetime
    updated_at: datetime
    output_url: Optional[str] = None
    error: Optional[str] = None
    demo: bool = False
    mesh_method: Optional[str] = None
    training_quality: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    colmap_available: bool
    open3d_available: bool
    inria_3dgs_available: bool = False
    demo_mode: bool


class PointCloudJobRequest(BaseModel):
    method: str = "luma"
