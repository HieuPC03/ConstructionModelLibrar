#!/usr/bin/env python3
"""
Train 3D Gaussian Splatting using gsplat (when installed).

Install on a CUDA machine:
  pip install gsplat torch torchvision
  # or use nerfstudio: pip install nerfstudio && ns-train splatfacto
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def train_with_gsplat(images: Path, sparse: Path, output: Path) -> None:
    try:
        import torch
        from gsplat import export_splat
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


def write_stub_output(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    meta = {
        "note": "Stub output — install gsplat + CUDA for real training",
        "format": "ply",
    }
    (output / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--sparse", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    try:
        train_with_gsplat(args.images, args.sparse, args.output)
    except RuntimeError as exc:
        print(f"Warning: {exc}", file=sys.stderr)
        write_stub_output(args.output)
        sys.exit(2)


if __name__ == "__main__":
    main()
