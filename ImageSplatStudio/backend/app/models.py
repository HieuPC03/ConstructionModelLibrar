from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    PREPROCESSING = "preprocessing"
    COLMAP = "colmap"
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
    status: JobStatus
    progress: JobProgress
    image_count: int
    created_at: datetime
    updated_at: datetime
    output_url: Optional[str] = None
    error: Optional[str] = None
    demo: bool = False


class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    colmap_available: bool
    demo_mode: bool
