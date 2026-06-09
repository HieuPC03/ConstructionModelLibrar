import os
import subprocess
from pathlib import Path


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


def check_open3d_available() -> bool:
    try:
        import open3d  # noqa: F401

        return True
    except ImportError:
        return False


def check_inria_3dgs_available() -> bool:
    raw = os.environ.get("GAUSSIAN_SPLATTING_DIR", "").strip()
    if not raw:
        return False
    repo = Path(raw).expanduser()
    return (repo / "train.py").is_file() and check_gpu_available()
