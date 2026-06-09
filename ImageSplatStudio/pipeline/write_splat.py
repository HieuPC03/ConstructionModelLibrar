#!/usr/bin/env python3
"""Write standard 32-byte-per-row .splat files for web viewers."""

from __future__ import annotations

import math
import struct
from pathlib import Path


def pack_rotation(w: float, x: float, y: float, z: float) -> bytes:
    """Pack quaternion into 4 uint8 values (mkkellogg / antimatter15 layout)."""
    comps = [w, x, y, z]
    return bytes(max(0, min(255, int(round(c * 128 + 128)))) for c in comps)


def write_demo_splat(path: Path, count: int = 4096) -> None:
    blob = bytearray()
    for i in range(count):
        ring = i % 512
        angle = (ring / 512) * math.tau
        radius = 0.5 + (ring / 512) * 1.8
        height = ((i // 512) / 8) * 2.0 - 1.0
        x = radius * math.cos(angle)
        z = radius * math.sin(angle)
        y = height
        scale = 0.02 + (ring % 7) * 0.004
        t = ring / 512
        rgba = (int(60 + 160 * t), int(180 - 80 * t), int(255 - 100 * t), 235)
        blob.extend(struct.pack("<fff", x, y, z))
        blob.extend(struct.pack("<fff", scale, scale, scale))
        blob.extend(struct.pack("<BBBB", *rgba))
        blob.extend(pack_rotation(1.0, 0.0, 0.0, 0.0))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(blob))


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "demo" / "demo.splat"
    write_demo_splat(out)
    print(f"Wrote {out} ({out.stat().st_size} bytes)")
