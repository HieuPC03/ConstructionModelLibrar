#!/usr/bin/env python3
"""
Convert point cloud or 3DGS PLY → .splat (Gaussian Splatting, Luma AI style).

Supports:
- Standard point clouds (.ply, .pcd, .xyz, ...)
- Existing 3D Gaussian Splatting PLY exports (Luma, Polycam, nerfstudio, etc.)
"""

from __future__ import annotations

import argparse
import math
import struct
import sys
from pathlib import Path

import _bootstrap  # noqa: F401 — add pipeline dir to sys.path

from write_splat import pack_rotation
from pointcloud_io import is_3dgs_ply_header, load_point_cloud_file


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def sh0_to_rgb(f0: float, f1: float, f2: float) -> tuple[int, int, int]:
    c0 = 0.28209479177387814
    r = max(0, min(255, int((0.5 + c0 * f0) * 255)))
    g = max(0, min(255, int((0.5 + c0 * f1) * 255)))
    b = max(0, min(255, int((0.5 + c0 * f2) * 255)))
    return r, g, b


def is_3dgs_ply(header_text: str) -> bool:
    return is_3dgs_ply_header(header_text)


def parse_3dgs_ply(path: Path) -> tuple[list, list, list, list, list]:
    """Parse 3D Gaussian Splatting PLY into splat components."""
    import numpy as np
    from plyfile import PlyData

    ply = PlyData.read(str(path))
    vertex = ply["vertex"]
    names = vertex.data.dtype.names or ()

    def col(name: str, default: float = 0.0):
        return np.asarray(vertex[name], dtype=np.float64) if name in names else np.full(len(vertex), default)

    xs, ys, zs = col("x"), col("y"), col("z")
    positions = list(zip(xs, ys, zs))

    if "f_dc_0" in names:
        colors = [sh0_to_rgb(f0, f1, f2) for f0, f1, f2 in zip(col("f_dc_0"), col("f_dc_1"), col("f_dc_2"))]
    elif "red" in names:
        colors = [(int(r), int(g), int(b)) for r, g, b in zip(col("red"), col("green"), col("blue"))]
    else:
        colors = [(200, 210, 225)] * len(positions)

    if "opacity" in names:
        alphas = [max(1, min(255, int(sigmoid(o) * 255))) for o in col("opacity")]
    else:
        alphas = [240] * len(positions)

    if "scale_0" in names:
        scales = [
            (max(1e-4, math.exp(s0)), max(1e-4, math.exp(s1)), max(1e-4, math.exp(s2)))
            for s0, s1, s2 in zip(col("scale_0"), col("scale_1"), col("scale_2"))
        ]
    else:
        scales = [(0.02, 0.02, 0.02)] * len(positions)

    if "rot_0" in names:
        rotations = list(zip(col("rot_0"), col("rot_1"), col("rot_2"), col("rot_3")))
    else:
        rotations = [(1.0, 0.0, 0.0, 0.0)] * len(positions)

    return positions, scales, colors, alphas, rotations


def load_point_cloud(path: Path):
    return load_point_cloud_file(path)


def estimate_scales(points, k: int = 8) -> list[tuple[float, float, float]]:
    import numpy as np
    import open3d as o3d

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    scales = []
    for i in range(len(points)):
        _, _, dists = o3d.geometry.KDTreeFlann(pcd).search_knn_vector_3d(pcd.points[i], k)
        if len(dists) > 1:
            avg = math.sqrt(float(np.mean(dists[1:])))
        else:
            avg = 0.02
        s = max(avg * 0.8, 0.003)
        scales.append((s, s, s))
    return scales


def densify_luma_style(points, colors, scales, mode: str):
    if mode != "luma":
        return points, colors, scales

    import numpy as np

    pts = np.asarray(points)
    cols = list(colors)
    scs = list(scales)
    rng = np.random.default_rng(42)
    extra_pts, extra_cols, extra_scs = [], [], []

    for p, c, s in zip(pts, cols, scs):
        radius = max(s[0], 0.004)
        for _ in range(2):
            extra_pts.append(p + rng.normal(0, radius * 0.35, size=3))
            extra_cols.append(c)
            extra_scs.append((s[0] * 1.15, s[1] * 1.15, s[2] * 1.15))

    combined = np.vstack([pts, np.asarray(extra_pts)])
    return combined.tolist(), cols + extra_cols, scs + extra_scs


def write_splat_file(path, positions, scales, colors, alphas, rotations, max_splats=500_000) -> int:
    count = min(len(positions), max_splats)
    blob = bytearray()
    for i in range(count):
        x, y, z = positions[i]
        sx, sy, sz = scales[i]
        r, g, b = colors[i]
        a = alphas[i] if i < len(alphas) else 240
        rw, rx, ry, rz = rotations[i] if i < len(rotations) else (1.0, 0.0, 0.0, 0.0)
        blob.extend(struct.pack("<fff", float(x), float(y), float(z)))
        blob.extend(struct.pack("<fff", float(sx), float(sy), float(sz)))
        blob.extend(struct.pack("<BBBB", int(r), int(g), int(b), int(a)))
        blob.extend(pack_rotation(float(rw), float(rx), float(ry), float(rz)))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(blob))
    return count


def convert_pointcloud(pcd, output_path: Path, mode: str = "luma") -> int:
    import numpy as np

    if isinstance(pcd, tuple) and pcd[0] == "3dgs_ply":
        positions, scales, colors, alphas, rotations = parse_3dgs_ply(pcd[1])
        print(f"STAGE:PREPROCESS\nDetected 3DGS PLY with {len(positions)} gaussians")
        print("STAGE:EXPORT")
        count = write_splat_file(output_path, positions, scales, colors, alphas, rotations)
        print(f"Exported {count} gaussians → {output_path}")
        return count

    if pcd.is_empty():
        raise ValueError("Point cloud rỗng")

    print("STAGE:PREPROCESS")
    bbox = pcd.get_axis_aligned_bounding_box()
    extent = max(bbox.get_extent())
    if len(pcd.points) > 200_000:
        voxel = max(extent / 400.0, 0.001)
        pcd = pcd.voxel_down_sample(voxel)
    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)

    points = np.asarray(pcd.points)
    if len(points) == 0:
        raise ValueError("Không còn điểm sau tiền xử lý")

    if pcd.has_colors():
        colors = [
            (max(0, min(255, int(c[0] * 255))), max(0, min(255, int(c[1] * 255))), max(0, min(255, int(c[2] * 255))))
            for c in np.asarray(pcd.colors)
        ]
    else:
        colors = [(190, 200, 220)] * len(points)

    print("STAGE:TRAINING")
    scale_mul = 2.2 if mode == "luma" else 1.0
    scales = [(s[0] * scale_mul, s[1] * scale_mul, s[2] * scale_mul) for s in estimate_scales(points)]
    alpha = 235 if mode == "luma" else 210
    alphas = [alpha] * len(points)
    rotations = [(1.0, 0.0, 0.0, 0.0)] * len(points)
    points, colors, scales = densify_luma_style(points, colors, scales, mode)

    print("STAGE:EXPORT")
    count = write_splat_file(output_path, points, scales, colors, alphas, rotations)
    print(f"Exported {count} gaussians → {output_path}")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Point cloud → 3D Gaussian Splat (.splat)")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=["luma", "standard"], default="luma")
    args = parser.parse_args()
    try:
        convert_pointcloud(load_point_cloud(args.input), args.output, args.mode)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
