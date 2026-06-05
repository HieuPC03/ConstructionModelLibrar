#!/usr/bin/env python3
"""Reconstruct a triangle mesh from a point cloud using Open3D."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from pointcloud_io import load_point_cloud_file


def load_point_cloud(path: Path):
    return load_point_cloud_file(path)


def reconstruct(
    input_path: Path,
    output_path: Path,
    method: str = "poisson",
    voxel_size: float = 0.0,
    depth: int = 9,
) -> None:
    import numpy as np
    import open3d as o3d

    print("STAGE:PREPROCESS")
    pcd = load_point_cloud(input_path)
    point_count = len(pcd.points)
    print(f"Loaded {point_count} points")

    if voxel_size <= 0:
        bbox = pcd.get_axis_aligned_bounding_box()
        extent = max(bbox.get_extent())
        voxel_size = max(extent / 200.0, 0.001)

    pcd = pcd.voxel_down_sample(voxel_size)
    if len(pcd.points) < 100:
        raise ValueError("Point cloud quá ít điểm sau khi lọc (cần ≥ 100).")

    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)

    if not pcd.has_normals():
        pcd.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(
                radius=voxel_size * 4,
                max_nn=30,
            )
        )
    pcd.orient_normals_consistent_tangent_plane(k=30)

    print("STAGE:MESHING")
    if method == "bpa":
        distances = pcd.compute_nearest_neighbor_distance()
        avg_dist = float(np.mean(distances))
        radii = o3d.utility.DoubleVector([avg_dist, avg_dist * 2, avg_dist * 4])
        mesh = o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(pcd, radii)
    else:
        mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd,
            depth=depth,
        )
        if len(densities) > 0:
            densities_np = np.asarray(densities)
            density_threshold = float(np.quantile(densities_np, 0.02))
            vertices_to_remove = densities_np < density_threshold
            mesh.remove_vertices_by_mask(vertices_to_remove)

    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()

    if len(mesh.vertices) == 0:
        raise ValueError("Không tạo được mesh từ point cloud.")

    if not mesh.has_vertex_colors() and pcd.has_colors():
        mesh.paint_uniform_color([0.72, 0.78, 0.86])

    print("STAGE:EXPORT")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not o3d.io.write_triangle_mesh(str(output_path), mesh, write_vertex_colors=True):
        raise RuntimeError(f"Export failed: {output_path}")

    print(f"Exported mesh: {len(mesh.vertices)} vertices, {len(mesh.triangles)} triangles")


def main() -> None:
    parser = argparse.ArgumentParser(description="Point cloud → 3D mesh")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--method", choices=["poisson", "bpa"], default="poisson")
    parser.add_argument("--voxel-size", type=float, default=0.0)
    parser.add_argument("--depth", type=int, default=9)
    args = parser.parse_args()

    try:
        reconstruct(args.input, args.output, args.method, args.voxel_size, args.depth)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
