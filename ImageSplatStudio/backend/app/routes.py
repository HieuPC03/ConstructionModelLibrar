from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.config import settings
from app.models import HealthResponse, JobCreateResponse, JobInfo, JobStatus, JobType, OutputFormat
from app.services.capabilities import check_colmap_available, check_gpu_available, check_open3d_available
from app.services.export_service import create_export_zip, safe_filename
from app.services.job_store import job_store
from app.services.pointcloud_preview import preview_upload
from app.services.pipeline_runner import pipeline_runner
from app.services.pointcloud_runner import pointcloud_runner
from app.services.upload_helpers import resolve_image_suffix, supported_image_formats_hint

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        gpu_available=check_gpu_available(),
        colmap_available=check_colmap_available(),
        open3d_available=check_open3d_available(),
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
async def create_image_job(
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

    job = job_store.create(
        name=name.strip() or "Untitled",
        job_type=JobType.IMAGES,
        output_format=OutputFormat.SPLAT,
        file_count=len(images),
        demo=demo,
    )
    upload_dir = job_store.job_dir(job.job_id, "uploads")

    saved = 0
    skipped = 0
    for index, upload in enumerate(images):
        suffix = resolve_image_suffix(upload.filename, upload.content_type)
        if suffix is None:
            skipped += 1
            continue
        dest = upload_dir / f"img_{index:04d}{suffix}"
        content = await upload.read()
        if len(content) == 0:
            skipped += 1
            continue
        dest.write_bytes(content)
        saved += 1

    if not demo and saved < 3:
        job_store.delete(job.job_id)
        formats = supported_image_formats_hint()
        detail = (
            f"Chỉ lưu được {saved}/{len(images)} ảnh. Cần ít nhất 3 ảnh hợp lệ. "
            f"Định dạng hỗ trợ: {formats}."
        )
        if skipped > 0:
            detail += (
                f" {skipped} file bị bỏ qua (HEIC/HEIF không hỗ trợ — "
                "hãy chuyển sang JPG/PNG trước khi upload)."
            )
        raise HTTPException(status_code=400, detail=detail)

    job_store.update(job.job_id, image_count=saved)
    pipeline_runner.start(job.job_id)

    return JobCreateResponse(
        job_id=job.job_id,
        message="Job đã tạo. Đang xử lý...",
    )


@router.post("/pointcloud-preview")
async def pointcloud_preview(file: UploadFile = File(...)) -> dict:
    if not check_open3d_available():
        raise HTTPException(status_code=503, detail="Open3D chưa sẵn sàng.")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in settings.pointcloud_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng không hỗ trợ. Dùng: {', '.join(sorted(settings.pointcloud_extensions))}",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File rỗng.")

    try:
        return preview_upload(content, suffix)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pointcloud-jobs", response_model=JobCreateResponse)
async def create_pointcloud_job(
    name: str = Form(...),
    demo: bool = Form(False),
    method: str = Form("luma"),
    pointcloud: UploadFile | None = File(default=None),
) -> JobCreateResponse:
    if method not in {"luma", "standard"}:
        raise HTTPException(status_code=400, detail="mode phải là luma hoặc standard.")

    if not demo and pointcloud is None:
        raise HTTPException(status_code=400, detail="Upload file point cloud (.ply, .pcd, .xyz, ...).")

    if not check_open3d_available():
        raise HTTPException(
            status_code=503,
            detail="Open3D chưa được cài trên server. Chạy: pip install open3d",
        )

    job = job_store.create(
        name=name.strip() or "Point Cloud",
        job_type=JobType.POINTCLOUD,
        output_format=OutputFormat.SPLAT,
        file_count=1 if pointcloud else 0,
        demo=demo,
        mesh_method=method,
    )
    upload_dir = job_store.job_dir(job.job_id, "uploads")

    if pointcloud is not None:
        suffix = Path(pointcloud.filename or "").suffix.lower()
        if suffix not in settings.pointcloud_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Định dạng không hỗ trợ. Dùng: {', '.join(sorted(settings.pointcloud_extensions))}",
            )
        content = await pointcloud.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File rỗng.")
        dest = upload_dir / f"input{suffix}"
        dest.write_bytes(content)

    pointcloud_runner.start(job.job_id)

    return JobCreateResponse(
        job_id=job.job_id,
        message="Đang chuyển point cloud thành hình khối 3D Gaussian...",
    )


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, str]:
    if job_store.get(job_id) is None:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")
    job_store.delete(job_id)
    return {"message": "Đã xóa job."}


@router.get("/jobs/{job_id}/model.splat")
def download_splat(job_id: str) -> FileResponse:
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Mô hình chưa sẵn sàng.")

    model_path = settings.data_dir / "outputs" / job_id / "model.splat"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="File mô hình không tồn tại.")

    filename = f"{safe_filename(job.name, job_id)}.splat"
    return FileResponse(
        path=model_path,
        media_type="application/octet-stream",
        filename=filename,
    )


@router.get("/jobs/{job_id}/export.zip")
def export_job_package(job_id: str) -> StreamingResponse:
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Dự án chưa hoàn tất — chưa thể xuất.")

    output_dir = settings.data_dir / "outputs" / job_id
    try:
        buf, archive_name = create_export_zip(job, output_dir)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu xuất.")

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{archive_name}"'},
    )


@router.get("/jobs/{job_id}/model.obj")
def download_mesh(job_id: str) -> FileResponse:
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")
    if job.status.value != "completed":
        raise HTTPException(status_code=409, detail="Mesh chưa sẵn sàng.")

    model_path = settings.data_dir / "outputs" / job_id / "model.obj"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="File mesh không tồn tại.")

    return FileResponse(
        path=model_path,
        media_type="model/obj",
        filename=f"{job.name or job_id}.obj",
    )
