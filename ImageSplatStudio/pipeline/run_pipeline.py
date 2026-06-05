#!/usr/bin/env python3
"""Cross-platform image → Gaussian Splat pipeline (replaces run_pipeline.sh on Windows)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent


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
    python = sys.executable

    work_dir.mkdir(parents=True, exist_ok=True)
    sparse_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    print("STAGE:PREPROCESS")
    run([python, str(PIPELINE_ROOT / "prepare_images.py"), str(input_dir), str(images_dir)])

    print("STAGE:COLMAP")
    colmap = os.environ.get("COLMAP_BIN", "colmap")
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

    print("STAGE:TRAINING")
    run([
        python, str(PIPELINE_ROOT / "train_gaussian_splat.py"),
        "--images", str(images_dir),
        "--sparse", str(sparse_dir / "0"),
        "--output", str(work_dir / "point_cloud"),
    ])

    print("STAGE:EXPORT")
    run([
        python, str(PIPELINE_ROOT / "export_splat.py"),
        "--input", str(work_dir / "point_cloud"),
        "--output", str(output_dir / "model.splat"),
    ])

    print("STAGE:DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
