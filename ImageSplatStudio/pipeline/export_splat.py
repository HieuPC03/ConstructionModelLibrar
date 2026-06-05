#!/usr/bin/env python3
"""Export trained Gaussians to .splat format for web viewer."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from write_splat import write_demo_splat


def find_ply(input_dir: Path) -> Path | None:
    candidates = list(input_dir.rglob("*.ply"))
    return candidates[0] if candidates else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    ply = find_ply(args.input)
    if ply is None:
        print("No PLY found — writing demo-style placeholder splat", file=sys.stderr)
        write_demo_splat(args.output, count=2048)
        return

    # Full PLY->splat conversion requires gsplat export; fallback to demo cloud for MVP
    print(f"PLY found at {ply}; using demo export until gsplat hookup", file=sys.stderr)
    write_demo_splat(args.output, count=4096)
    print(f"Exported {args.output}")


if __name__ == "__main__":
    main()

