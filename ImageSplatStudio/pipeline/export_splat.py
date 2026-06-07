#!/usr/bin/env python3
"""Export trained Gaussians to .splat format for web viewer."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from inria_3dgs import find_latest_point_cloud_ply
from pointcloud_to_gaussian import parse_3dgs_ply, write_splat_file
from write_splat import write_demo_splat


def find_ply(input_dir: Path) -> Path | None:
    inria_ply = find_latest_point_cloud_ply(input_dir)
    if inria_ply is not None:
        return inria_ply

    candidates = sorted(input_dir.rglob("*.ply"), key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def export_ply_to_splat(ply: Path, output: Path, max_splats: int = 500_000) -> int:
    positions, scales, colors, alphas, rotations = parse_3dgs_ply(ply)
    count = write_splat_file(output, positions, scales, colors, alphas, rotations, max_splats=max_splats)
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-splats", type=int, default=500_000)
    args = parser.parse_args()

    ply = find_ply(args.input)
    if ply is None:
        print("No PLY found — writing demo-style placeholder splat", file=sys.stderr)
        write_demo_splat(args.output, count=2048)
        return

    try:
        count = export_ply_to_splat(ply, args.output, max_splats=args.max_splats)
        print(f"Converted {ply.name} ({count} gaussians) → {args.output}")
    except Exception as exc:
        print(f"PLY conversion failed ({exc}) — demo fallback", file=sys.stderr)
        write_demo_splat(args.output, count=4096)


if __name__ == "__main__":
    main()
