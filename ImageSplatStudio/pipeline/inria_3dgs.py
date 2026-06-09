#!/usr/bin/env python3
"""
Utilities for integrating Inria 3D Gaussian Splatting
(https://github.com/graphdeco-inria/gaussian-splatting).

Expects a COLMAP dataset with undistorted PINHOLE cameras:
  <dataset>/
    images/
    sparse/0/
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

QUALITY_PRESETS: dict[str, dict[str, int | list[int]]] = {
    "preview": {"iterations": 7_000, "save_iterations": [7_000]},
    "standard": {"iterations": 30_000, "save_iterations": [7_000, 30_000]},
}


def resolve_inria_dir() -> Path | None:
    raw = os.environ.get("GAUSSIAN_SPLATTING_DIR", "").strip()
    if not raw:
        return None
    path = Path(raw).expanduser().resolve()
    if (path / "train.py").is_file():
        return path
    return None


def inria_available() -> bool:
    repo = resolve_inria_dir()
    if repo is None:
        return False
    try:
        import torch  # noqa: F401

        return torch.cuda.is_available()
    except ImportError:
        return False


def quality_from_env() -> str:
    value = os.environ.get("TRAINING_QUALITY", "standard").strip().lower()
    return value if value in QUALITY_PRESETS else "standard"


def iterations_from_env() -> tuple[int, list[int]]:
    preset = QUALITY_PRESETS[quality_from_env()]
    custom = os.environ.get("TRAINING_ITERATIONS", "").strip()
    if custom.isdigit():
        it = int(custom)
        return it, [it]
    iterations = int(preset["iterations"])
    save_iterations = list(preset["save_iterations"])
    return iterations, save_iterations


def run_colmap_undistort(
    *,
    images_dir: Path,
    sparse_dir: Path,
    output_dir: Path,
    colmap_bin: str = "colmap",
) -> Path:
    """Undistort COLMAP reconstruction into an Inria-compatible dataset folder."""
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        colmap_bin,
        "image_undistorter",
        "--image_path",
        str(images_dir),
        "--input_path",
        str(sparse_dir),
        "--output_path",
        str(output_dir),
        "--output_type",
        "COLMAP",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"COLMAP image_undistorter failed: {detail}")

    dataset_sparse = output_dir / "sparse" / "0"
    if not dataset_sparse.is_dir():
        raise RuntimeError(f"Undistorted sparse model missing: {dataset_sparse}")
    if not (output_dir / "images").is_dir():
        raise RuntimeError(f"Undistorted images missing: {output_dir / 'images'}")
    return output_dir


def find_latest_point_cloud_ply(search_root: Path) -> Path | None:
    """Find the highest-iteration point_cloud.ply from Inria training output."""
    best_iter = -1
    best_path: Path | None = None
    pattern = re.compile(r"^iteration_(\d+)$")

    for ply in search_root.rglob("point_cloud.ply"):
        parent_name = ply.parent.name
        match = pattern.match(parent_name)
        if match:
            iteration = int(match.group(1))
            if iteration > best_iter:
                best_iter = iteration
                best_path = ply
        elif best_path is None:
            best_path = ply

    return best_path


def train_inria(
    *,
    dataset_dir: Path,
    model_dir: Path,
    iterations: int | None = None,
    save_iterations: list[int] | None = None,
    disable_viewer: bool = True,
) -> Path:
    """Run official Inria train.py and return the model output directory."""
    repo = resolve_inria_dir()
    if repo is None:
        raise RuntimeError(
            "GAUSSIAN_SPLATTING_DIR chưa cấu hình. "
            "Clone https://github.com/graphdeco-inria/gaussian-splatting "
            "và đặt biến môi trường GAUSSIAN_SPLATTING_DIR."
        )

    if iterations is None or save_iterations is None:
        iterations, save_iterations = iterations_from_env()

    model_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(repo / "train.py"),
        "-s",
        str(dataset_dir.resolve()),
        "-m",
        str(model_dir.resolve()),
        "--iterations",
        str(iterations),
        "--save_iterations",
        *[str(x) for x in save_iterations],
    ]
    if disable_viewer:
        cmd.append("--disable_viewer")

    print(f"Running Inria 3DGS: {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, cwd=str(repo))
    if result.returncode != 0:
        raise RuntimeError(f"Inria train.py failed with exit code {result.returncode}")

    ply = find_latest_point_cloud_ply(model_dir)
    if ply is None:
        raise RuntimeError(f"No point_cloud.ply found under {model_dir}")
    print(f"Inria training complete: {ply}", flush=True)
    return model_dir
