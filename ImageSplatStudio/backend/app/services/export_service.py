import io
import json
import re
import zipfile
from pathlib import Path

from app.models import JobInfo


def safe_filename(name: str, fallback: str = "export") -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", name.strip())
    cleaned = re.sub(r"\s+", "_", cleaned)
    return cleaned[:80] or fallback


def build_export_readme(job: JobInfo) -> str:
    return f"""ImageSplat Studio — Export Package
================================

Project: {job.name}
Job ID: {job.job_id}
Type: {job.job_type.value}
Created: {job.created_at.isoformat()}
Completed: {job.updated_at.isoformat()}

Files:
  model.splat  — 3D Gaussian Splat model (view in Luma, Polycam, or ImageSplat Studio)
  project.json — Project metadata

Usage:
  - Import model.splat into compatible Gaussian Splat viewers
  - Share the .zip file with collaborators
"""


def create_export_zip(job: JobInfo, output_dir: Path) -> tuple[io.BytesIO, str]:
    splat_path = output_dir / "model.splat"
    if not splat_path.exists():
        raise FileNotFoundError("model.splat not found")

    folder = safe_filename(job.name, job.job_id)
    archive_name = f"{folder}-export.zip"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(splat_path, f"{folder}/model.splat")

        meta = {
            "job_id": job.job_id,
            "name": job.name,
            "job_type": job.job_type.value,
            "output_format": job.output_format.value,
            "image_count": job.image_count,
            "demo": job.demo,
            "mesh_method": job.mesh_method,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.updated_at.isoformat(),
            "exported_by": "ImageSplat Studio",
        }
        zf.writestr(f"{folder}/project.json", json.dumps(meta, indent=2, ensure_ascii=False))
        zf.writestr(f"{folder}/README.txt", build_export_readme(job))

        obj_path = output_dir / "model.obj"
        if obj_path.exists():
            zf.write(obj_path, f"{folder}/model.obj")

    buf.seek(0)
    return buf, archive_name
