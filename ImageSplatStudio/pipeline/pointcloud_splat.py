"""3D Gaussian Splatting import utilities (TREND-POINT Ver.12 スプラット)."""

from __future__ import annotations

from pathlib import Path

import numpy as np


def parse_3dgs_ply(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return positions (N,3), colors (N,3) 0-1, alphas (N,) 0-1."""
    from plyfile import PlyData

    ply = PlyData.read(str(path))
    vertex = ply["vertex"]
    names = set(vertex.data.dtype.names or ())

    xs = np.asarray(vertex["x"], dtype=np.float64)
    ys = np.asarray(vertex["y"], dtype=np.float64)
    zs = np.asarray(vertex["z"], dtype=np.float64)
    positions = np.stack([xs, ys, zs], axis=1)

    if "red" in names:
        colors = np.stack(
            [
                np.asarray(vertex["red"], dtype=np.float64) / 255.0,
                np.asarray(vertex["green"], dtype=np.float64) / 255.0,
                np.asarray(vertex["blue"], dtype=np.float64) / 255.0,
            ],
            axis=1,
        )
    elif "f_dc_0" in names:
        sh = np.stack(
            [
                np.asarray(vertex["f_dc_0"], dtype=np.float64),
                np.asarray(vertex["f_dc_1"], dtype=np.float64),
                np.asarray(vertex["f_dc_2"], dtype=np.float64),
            ],
            axis=1,
        )
        colors = np.clip(0.5 + 0.282095 * sh, 0, 1)
    else:
        colors = np.full((len(positions), 3), 0.7, dtype=np.float64)

    if "opacity" in names:
        op = np.asarray(vertex["opacity"], dtype=np.float64)
        alphas = 1.0 / (1.0 + np.exp(-op))
    else:
        alphas = np.ones(len(positions), dtype=np.float64)

    return positions, colors, alphas


def filter_splat(
    positions: np.ndarray,
    colors: np.ndarray,
    alphas: np.ndarray,
    *,
    alpha_threshold: float = 0.05,
    strength: float = 0.5,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Filter low-opacity splats (TREND-POINT フィルタリング). strength 0–1."""
    thr = max(0.0, min(1.0, alpha_threshold + (1.0 - strength) * 0.4))
    mask = alphas >= thr
    return positions[mask], colors[mask], alphas[mask]


def apply_splat_transform(
    positions: np.ndarray,
    *,
    offset: list[float] | None = None,
    scale: float = 1.0,
    swap_xy: bool = False,
) -> np.ndarray:
    pts = np.asarray(positions, dtype=np.float64).copy()
    if swap_xy:
        pts[:, [0, 1]] = pts[:, [1, 0]]
    pts *= float(scale)
    if offset:
        pts += np.asarray(offset[:3], dtype=np.float64)
    return pts.astype(np.float32)


def splat_to_point_cloud(
    path: Path,
    *,
    alpha_threshold: float = 0.05,
    filter_strength: float = 0.5,
    offset: list[float] | None = None,
    scale: float = 1.0,
    swap_xy: bool = False,
    max_points: int = 500_000,
) -> tuple[np.ndarray, np.ndarray]:
    """Convert 3DGS PLY to point cloud (TREND-POINT 点群として登録)."""
    positions, colors, alphas = parse_3dgs_ply(path)
    positions, colors, alphas = filter_splat(
        positions, colors, alphas, alpha_threshold=alpha_threshold, strength=filter_strength
    )
    positions = apply_splat_transform(positions, offset=offset, scale=scale, swap_xy=swap_xy)
    if len(positions) > max_points:
        rng = np.random.default_rng(42)
        idx = rng.choice(len(positions), max_points, replace=False)
        positions = positions[idx]
        colors = colors[idx]
    return positions, colors.astype(np.float32)
