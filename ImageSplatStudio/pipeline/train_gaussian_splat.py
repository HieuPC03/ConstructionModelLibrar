#!/usr/bin/env python3
"""
Train 3D Gaussian Splatting from COLMAP data.

Fallback chain:
  1. Inria 3DGS (graphdeco-inria/gaussian-splatting) when GAUSSIAN_SPLATTING_DIR is set
  2. gsplat simple_trainer when gsplat + CUDA are available
  3. Stub metadata (demo / no GPU)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from inria_3dgs import inria_available, train_inria


def train_with_inria(dataset: Path, output: Path) -> None:
    train_inria(dataset_dir=dataset, model_dir=output)


def train_with_gsplat(images: Path, sparse: Path, output: Path) -> None:
    try:
        import torch
        from gsplat.examples.simple_trainer import Config, Runner
    except ImportError as exc:
        raise RuntimeError(
            "gsplat chưa được cài. Chạy: pip install gsplat torch"
        ) from exc

    if not torch.cuda.is_available():
        raise RuntimeError("Cần GPU CUDA để huấn luyện Gaussian Splatting.")

    output.mkdir(parents=True, exist_ok=True)
    cfg = Config(
        data_dir=str(images.parent),
        result_dir=str(output),
        max_steps=7000,
        eval_steps=[],
        save_steps=[7000],
    )
    runner = Runner(cfg)
    runner.train()
    runner.eval()


def write_stub_output(output: Path, reason: str) -> None:
    output.mkdir(parents=True, exist_ok=True)
    meta = {
        "note": reason,
        "format": "ply",
        "trainers_tried": ["inria", "gsplat"],
    }
    (output / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, help="COLMAP dataset root (sparse/0 + images/)")
    parser.add_argument("--images", type=Path, help="Images folder (gsplat fallback)")
    parser.add_argument("--sparse", type=Path, help="COLMAP sparse/0 (gsplat fallback)")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    dataset = args.dataset
    if dataset is None and args.images is not None:
        dataset = args.images.parent

    errors: list[str] = []

    if dataset is not None and inria_available():
        try:
            print("Trainer: Inria 3D Gaussian Splatting", flush=True)
            train_with_inria(dataset, args.output)
            return
        except RuntimeError as exc:
            errors.append(f"Inria: {exc}")
            print(f"Warning: {exc}", file=sys.stderr)

    if args.images is not None and args.sparse is not None:
        try:
            print("Trainer: gsplat", flush=True)
            train_with_gsplat(args.images, args.sparse, args.output)
            return
        except RuntimeError as exc:
            errors.append(f"gsplat: {exc}")
            print(f"Warning: {exc}", file=sys.stderr)

    reason = "; ".join(errors) if errors else "No CUDA trainer available"
    print(f"Using stub output — {reason}", file=sys.stderr)
    write_stub_output(args.output, reason)
    sys.exit(2)


if __name__ == "__main__":
    main()
