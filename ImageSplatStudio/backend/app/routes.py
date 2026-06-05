from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import settings
from app.models import HealthResponse, JobCreateResponse, JobInfo
from app.services.job_store import check_colmap_available, check_gpu_available, job_store
from app.services.pipeline_runner import pipeline_runner

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        gpu_available=check_gpu_available(),
        colmap_available=check_colmap_available(),
        demo_mode=settings.demo_mode or not check_gpu_available(),
    )


@router.get("/jobs", response_model=list[JobInfo])
def list_jobs() -> list[JobInfo]:
    return job_store.list_jobs()


@router.get("/jobs/{job_id}", response_model=JobInfo)
def get_job(job_id: str) -> JobInfo:
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")
    return job


@router.post("/jobs", response_model=JobCreateResponse)
async def create_job(
    name: str = Form(...),
    demo: bool = Form(False),
    images: list[UploadFile] = File(default=[]),
) -> JobCreateResponse:
    if not demo and len(images) < 3:
        raise HTTPException(
            status_code=400,
            detail="Upload ít nhất 3 ảnh (khuyến nghị 20–100 ảnh quanh vật thể).",
        )
    if len(images) > settings.max_upload_images:
        raise HTTPException(
            status_code=400,
            detail=f"Tối đa {settings.max_upload_images} ảnh mỗi job.",
        )

    job = job_store.create(name=name.strip() or "Untitled", image_count=len(images), demo=demo)
    upload_dir = job_store.job_dir(job.job_id, "uploads")

    saved = 0
    for index, upload in enumerate(images):
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in settings.allowed_extensions:
            continue
        dest = upload_dir / f"img_{index:04d}{suffix}"
        content = await upload.read()
        if len(content) == 0:
            continue
        dest.write_bytes(content)
        saved += 1

    job_store.update(job.job_id, image_count=saved)
    pipeline_runner.start(job.job_id)

    return JobCreateResponse(
        job_id=job.job_id,
        message="Job đã tạo. Đang xử lý...",
    )


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, str]:
    if job_store.get(job_id) is None:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")
    job_store.delete(job_id)
    return {"message": "Đã xóa job."}


@router.get("/jobs/{job_id}/model.splat")
def download_model(job_id: str) -> FileResponse:
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")
    if job.status.value != "completed":
        raise HTTPException(status_code=409, detail="Mô hình chưa sẵn sàng.")

    model_path = settings.data_dir / "outputs" / job_id / "model.splat"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="File mô hình không tồn tại.")

    return FileResponse(
        path=model_path,
        media_type="application/octet-stream",
        filename=f"{job.name or job_id}.splat",
    )
