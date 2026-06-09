"""Smoke test for Ch.3 file import/export (no Open3D session required for PLY write)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np

from pointcloud_export import write_ply_file, write_xyz_txt


def test_ply_roundtrip_text() -> None:
    pts = np.array([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]], dtype=np.float64)
    cols = np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], dtype=np.float64)
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "out.ply"
        write_ply_file(path, pts, cols)
        text = path.read_text(encoding="utf-8")
        assert "element vertex 2" in text
        assert "1.000000 2.000000 3.000000 255 0 0" in text


def test_xyz_export() -> None:
    pts = np.array([[0.1, 0.2, 0.3]], dtype=np.float64)
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "out.txt"
        write_xyz_txt(path, pts)
        assert path.read_text(encoding="utf-8").strip() == "0.100000 0.200000 0.300000"


if __name__ == "__main__":
    test_ply_roundtrip_text()
    test_xyz_export()
    print("OK: Ch.3 file I/O smoke tests passed")
