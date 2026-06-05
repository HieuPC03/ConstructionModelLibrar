#!/usr/bin/env python3
"""Generate app icon PNG/ICO matching the in-app Luma-style gradient orb logo."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "desktop" / "assets"


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def gradient_color(t: float) -> tuple[int, int, int, int]:
    """Purple (#c084fc) -> indigo (#818cf8) -> cyan (#22d3ee)."""
    if t < 0.45:
        u = t / 0.45
        r = lerp(192, 129, u)
        g = lerp(132, 140, u)
        b = lerp(252, 248, u)
    else:
        u = (t - 0.45) / 0.55
        r = lerp(129, 34, u)
        g = lerp(140, 211, u)
        b = lerp(248, 238, u)
    return int(r), int(g), int(b), 255


def render_orb(size: int) -> list[list[tuple[int, int, int, int]]]:
    cx = cy = size / 2
    radius = size * 0.42
    pixels: list[list[tuple[int, int, int, int]]] = []

    for y in range(size):
        row: list[tuple[int, int, int, int]] = []
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist > radius:
                row.append((0, 0, 0, 0))
                continue

            nx = (x - cx * 0.75) / radius
            ny = (y - cy * 0.7) / radius
            t = max(0.0, min(1.0, 0.35 + nx * 0.35 + ny * 0.3))
            r, g, b, a = gradient_color(t)

            edge = dist / radius
            shade = 0.85 + 0.15 * (1 - edge * edge)
            r = min(255, int(r * shade))
            g = min(255, int(g * shade))
            b = min(255, int(b * shade))

            if dx * dx + (dy + radius * 0.15) ** 2 < (radius * 0.22) ** 2:
                r = min(255, r + 40)
                g = min(255, g + 40)
                b = min(255, b + 40)

            row.append((r, g, b, a))
        pixels.append(row)
    return pixels


def write_png(path: Path, size: int) -> None:
    pixels = render_orb(size)
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b, a in row:
            raw.extend((r, g, b, a))

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def write_ico(path: Path, sizes: list[int]) -> None:
    images: list[tuple[int, bytes]] = []
    for s in sizes:
        px = render_orb(s)
        and_mask = b"\x00" * ((s + 31) // 32 * 4 * s)
        xor = bytearray()
        for row in reversed(px):
            for r, g, b, a in row:
                xor.extend((b, g, r, a))
        images.append((s, bytes(xor) + and_mask))

    offset = 6 + 16 * len(images)
    header = struct.pack("<HHH", 0, 1, len(images))
    entries = bytearray()
    data = bytearray()
    for s, bmp in images:
        w = 0 if s >= 256 else s
        h = 0 if s >= 256 else s
        entries.extend(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(bmp), offset))
        offset += len(bmp)
        data.extend(bmp)
    path.write_bytes(header + bytes(entries) + bytes(data))


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    write_png(ASSETS / "icon.png", 512)
    write_png(ASSETS / "icon-256.png", 256)

    try:
        from PIL import Image

        img = Image.open(ASSETS / "icon-256.png").convert("RGBA")
        img.save(
            ASSETS / "icon.ico",
            format="ICO",
            sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
        )
        print("  icon.ico (Pillow)")
    except ImportError:
        write_ico(ASSETS / "icon.ico", [256, 128, 64, 48, 32, 16])
        print("  icon.ico (fallback writer)")

    print(f"Generated icons in {ASSETS}")


if __name__ == "__main__":
    main()
