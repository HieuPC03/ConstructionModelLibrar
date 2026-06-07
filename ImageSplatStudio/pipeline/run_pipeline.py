#!/usr/bin/env python3
"""Cross-platform image → Gaussian Splat pipeline (replaces run_pipeline.sh on Windows)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

PIPELINE_ROOT = Path(__file__).resolve().parent

from inria_3dgs import run_colmap_undistort


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
    result = subprocess.run(cmd, cwd=str(cwd or PIPELINE_ROOT))
    if result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}")


def main() -> int:
    input_dir = Path(os.environ["INPUT_DIR"])
    output_dir = Path(os.environ["OUTPUT_DIR"])
    work_dir = output_dir / "work"
    colmap_db = work_dir / "database.db"
    sparse_dir = work_dir / "sparse"
    images_dir = work_dir / "images"
    dataset_dir = work_dir / "dataset"
    model_dir = work_dir / "inria_model"
    python = sys.executable
    colmap = os.environ.get("COLMAP_BIN", "colmap")

    work_dir.mkdir(parents=True, exist_ok=True)
    sparse_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    print("STAGE:PREPROCESS")
    run([python, str(PIPELINE_ROOT / "prepare_images.py"), str(input_dir), str(images_dir)])

    print("STAGE:COLMAP")
    run([
        colmap, "feature_extractor",
        "--database_path", str(colmap_db),
        "--image_path", str(images_dir),
        "--ImageReader.single_camera", "1",
        "--SiftExtraction.use_gpu", "1",
    ])
    run([
        colmap, "exhaustive_matcher",
        "--database_path", str(colmap_db),
        "--SiftMatching.use_gpu", "1",
    ])
    (sparse_dir / "0").mkdir(parents=True, exist_ok=True)
    run([
        colmap, "mapper",
        "--database_path", str(colmap_db),
        "--image_path", str(images_dir),
        "--output_path", str(sparse_dir),
    ])

    print("STAGE:COLMAP_UNDISTORT")
    run_colmap_undistort(
        images_dir=images_dir,
        sparse_dir=sparse_dir / "0",
        output_dir=dataset_dir,
        colmap_bin=colmap,
    )

    print("STAGE:TRAINING")
    run([
        python, str(PIPELINE_ROOT / "train_gaussian_splat.py"),
        "--dataset", str(dataset_dir),
        "--images", str(dataset_dir / "images"),
        "--sparse", str(dataset_dir / "sparse" / "0"),
        "--output", str(model_dir),
    ])

    print("STAGE:EXPORT")
    run([
        python, str(PIPELINE_ROOT / "export_splat.py"),
        "--input", str(model_dir),
        "--output", str(output_dir / "model.splat"),
    ])

    print("STAGE:DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
