import io
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

from app.config import settings
from app.models import JobInfo
from app.services.python_exec import get_python_executable

PIPELINE_ROOT = settings.app_root / "pipeline"


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

        fbx_path = output_dir / "model.fbx"
        if fbx_path.exists():
            zf.write(fbx_path, f"{folder}/model.fbx")

    buf.seek(0)
    return buf, archive_name


def ensure_fbx_export(job_id: str, output_dir: Path) -> Path:
    """Generate model.fbx on demand from model.splat."""
    fbx_path = output_dir / "model.fbx"
    splat_path = output_dir / "model.splat"
    if fbx_path.exists() and fbx_path.stat().st_size > 0:
        return fbx_path
    if not splat_path.exists():
        raise FileNotFoundError("model.splat not found")

    script = PIPELINE_ROOT / "export_fbx.py"
    if not script.exists():
        raise FileNotFoundError(f"export_fbx.py not found: {script}")

    python = get_python_executable()
    env = {
        **os.environ,
        "PYTHONPATH": os.pathsep.join(p for p in (str(PIPELINE_ROOT), os.environ.get("PYTHONPATH", "")) if p),
    }
    result = subprocess.run(
        [python, str(script), "--input", str(splat_path), "--output", str(fbx_path)],
        cwd=str(PIPELINE_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0 or not fbx_path.exists():
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "FBX export failed")
    return fbx_path
