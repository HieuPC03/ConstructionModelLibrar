#!/usr/bin/env python3
"""Generate a demo point cloud PLY for testing."""

from __future__ import annotations

import math
from pathlib import Path


def write_demo_pointcloud(path: Path, count: int = 8000) -> None:
    import numpy as np
    import open3d as o3d

    points = []
    colors = []
    for i in range(count):
        u = (i % 100) / 100.0
        v = (i // 100) / (count / 100)
        theta = u * math.tau
        phi = v * math.pi
        r = 1.0 + 0.08 * math.sin(5 * theta) * math.sin(4 * phi)
        x = r * math.sin(phi) * math.cos(theta)
        y = r * math.sin(phi) * math.sin(theta)
        z = r * math.cos(phi)
        points.append([x, y, z])
        colors.append([0.3 + 0.4 * u, 0.5 + 0.3 * v, 0.85])

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(np.asarray(points))
    pcd.colors = o3d.utility.Vector3dVector(np.asarray(colors))
    path.parent.mkdir(parents=True, exist_ok=True)
    o3d.io.write_point_cloud(str(path), pcd)
    print(f"Wrote {path} ({count} points)")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "demo" / "demo_pointcloud.ply"
    write_demo_pointcloud(out)
