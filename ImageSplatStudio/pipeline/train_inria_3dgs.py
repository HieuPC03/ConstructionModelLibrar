#!/usr/bin/env python3
"""CLI wrapper for Inria 3D Gaussian Splatting training."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from inria_3dgs import inria_available, iterations_from_env, train_inria


def main() -> int:
    parser = argparse.ArgumentParser(description="Train with Inria 3D Gaussian Splatting")
    parser.add_argument("--dataset", type=Path, required=True, help="COLMAP dataset root")
    parser.add_argument("--output", type=Path, required=True, help="Model output directory")
    parser.add_argument("--iterations", type=int, default=None)
    parser.add_argument(
        "--save-iterations",
        type=int,
        nargs="*",
        default=None,
        help="Checkpoint iterations (default from TRAINING_QUALITY env)",
    )
    args = parser.parse_args()

    if not inria_available():
        print(
            "Inria 3DGS unavailable (need GAUSSIAN_SPLATTING_DIR + CUDA PyTorch).",
            file=sys.stderr,
        )
        return 2

    iterations, save_iters = iterations_from_env()
    if args.iterations is not None:
        iterations = args.iterations
    if args.save_iterations is not None:
        save_iters = args.save_iterations

    try:
        train_inria(
            dataset_dir=args.dataset,
            model_dir=args.output,
            iterations=iterations,
            save_iterations=save_iters,
        )
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
