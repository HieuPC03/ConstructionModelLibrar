#!/usr/bin/env python3
"""Copy and optionally resize uploaded images for COLMAP."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore

MAX_EDGE = 2048


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: prepare_images.py <input_dir> <output_dir>")
        sys.exit(1)

    src_dir = Path(sys.argv[1])
    dst_dir = Path(sys.argv[2])
    dst_dir.mkdir(parents=True, exist_ok=True)

    extensions = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
    images = sorted(p for p in src_dir.iterdir() if p.suffix.lower() in extensions)

    for index, src in enumerate(images):
        dst = dst_dir / f"frame_{index:05d}.jpg"
        if Image is None:
            shutil.copy2(src, dst)
            continue

        with Image.open(src) as img:
            img = img.convert("RGB")
            w, h = img.size
            scale = min(1.0, MAX_EDGE / max(w, h))
            if scale < 1.0:
                img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
            img.save(dst, quality=92)


if __name__ == "__main__":
    main()
