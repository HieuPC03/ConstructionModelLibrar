import json
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from app.config import settings
from app.models import JobInfo, JobProgress, JobStatus


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, JobInfo] = {}
        self._lock = Lock()

    def create(self, name: str, image_count: int = 0, demo: bool = False) -> JobInfo:
        job_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc)
        job = JobInfo(
            job_id=job_id,
            name=name,
            status=JobStatus.PENDING,
            progress=JobProgress(
                stage=JobStatus.PENDING,
                percent=0,
                message="Đang chờ xử lý...",
            ),
            image_count=image_count,
            created_at=now,
            updated_at=now,
            demo=demo,
        )
        with self._lock:
            self._jobs[job_id] = job
        self._persist(job)
        return job

    def get(self, job_id: str) -> JobInfo | None:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is not None:
            return job
        return self._load(job_id)

    def list_jobs(self) -> list[JobInfo]:
        with self._lock:
            in_memory = list(self._jobs.values())
        disk_jobs = []
        jobs_dir = settings.data_dir / "jobs"
        if jobs_dir.exists():
            for path in jobs_dir.glob("*.json"):
                loaded = self._load(path.stem)
                if loaded is not None:
                    disk_jobs.append(loaded)
        merged = {job.job_id: job for job in disk_jobs}
        merged.update({job.job_id: job for job in in_memory})
        return sorted(merged.values(), key=lambda j: j.updated_at, reverse=True)

    def update(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: JobProgress | None = None,
        image_count: int | None = None,
        output_url: str | None = None,
        error: str | None = None,
    ) -> JobInfo | None:
        job = self.get(job_id)
        if job is None:
            return None

        if status is not None:
            job.status = status
        if progress is not None:
            job.progress = progress
        if image_count is not None:
            job.image_count = image_count
        if output_url is not None:
            job.output_url = output_url
        if error is not None:
            job.error = error
        job.updated_at = datetime.now(timezone.utc)

        with self._lock:
            self._jobs[job_id] = job
        self._persist(job)
        return job

    def delete(self, job_id: str) -> bool:
        with self._lock:
            self._jobs.pop(job_id, None)
        meta = settings.data_dir / "jobs" / f"{job_id}.json"
        if meta.exists():
            meta.unlink()
        for folder in (
            settings.data_dir / "uploads" / job_id,
            settings.data_dir / "outputs" / job_id,
        ):
            if folder.exists():
                shutil.rmtree(folder, ignore_errors=True)
        return True

    def job_dir(self, job_id: str, kind: str) -> Path:
        path = settings.data_dir / kind / job_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _persist(self, job: JobInfo) -> None:
        jobs_dir = settings.data_dir / "jobs"
        jobs_dir.mkdir(parents=True, exist_ok=True)
        path = jobs_dir / f"{job.job_id}.json"
        path.write_text(job.model_dump_json(indent=2), encoding="utf-8")

    def _load(self, job_id: str) -> JobInfo | None:
        path = settings.data_dir / "jobs" / f"{job_id}.json"
        if not path.exists():
            return None
        try:
            job = JobInfo.model_validate_json(path.read_text(encoding="utf-8"))
        except Exception:
            return None
        with self._lock:
            self._jobs[job_id] = job
        return job


job_store = JobStore()


def check_gpu_available() -> bool:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return result.returncode == 0 and bool(result.stdout.strip())
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_colmap_available() -> bool:
    try:
        result = subprocess.run(
            ["colmap", "-h"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
