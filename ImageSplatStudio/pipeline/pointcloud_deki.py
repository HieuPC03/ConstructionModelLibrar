"""出来形 evaluation — deviation heatmap (TREND-POINT Ver.12 出来形管理)."""

from __future__ import annotations

import math

import numpy as np


def compute_deviation_heatmap(
    grid_data: dict,
    design_values: np.ndarray | None = None,
    design_z: float | None = None,
    *,
    tolerance_ok: float = 0.05,
    tolerance_warn: float = 0.15,
) -> dict:
    """
    Compare measured IDW grid vs design surface.
    Returns per-cell deviation and color class for heatmap overlay.
    """
    values = np.asarray(grid_data["values"], dtype=np.float64)
    ny, nx = values.shape

    if design_values is not None:
        design = np.asarray(design_values, dtype=np.float64)
        if design.shape != values.shape:
            raise ValueError("Design grid size must match measured grid")
    elif design_z is not None:
        design = np.full_like(values, float(design_z))
    else:
        raise ValueError("Cần design_values hoặc design_z")

    valid = ~np.isnan(values) & ~np.isnan(design)
    deviation = np.full_like(values, np.nan)
    deviation[valid] = values[valid] - design[valid]

    color_class = np.zeros((ny, nx), dtype=np.int8)
    abs_dev = np.abs(deviation)
    color_class[valid & (abs_dev <= tolerance_ok)] = 1
    color_class[valid & (abs_dev > tolerance_ok) & (abs_dev <= tolerance_warn)] = 2
    color_class[valid & (abs_dev > tolerance_warn)] = 3

    flat = deviation[valid]
    stats = {
        "mean_m": float(np.mean(flat)) if len(flat) else 0.0,
        "max_m": float(np.max(flat)) if len(flat) else 0.0,
        "min_m": float(np.min(flat)) if len(flat) else 0.0,
        "rmse_m": float(np.sqrt(np.mean(flat**2))) if len(flat) else 0.0,
        "within_ok_pct": float(np.sum(abs_dev[valid] <= tolerance_ok) / max(np.sum(valid), 1) * 100),
        "valid_cells": int(np.sum(valid)),
    }

    return {
        "deviation": deviation.tolist(),
        "color_class": color_class.tolist(),
        "tolerance_ok_m": tolerance_ok,
        "tolerance_warn_m": tolerance_warn,
        "stats": stats,
        "xs": grid_data.get("xs", []),
        "ys": grid_data.get("ys", []),
        "cell_size": grid_data.get("cell_size", 1.0),
        "size": grid_data.get("size", [nx, ny]),
    }


def parse_survey_csv(
    text: str,
    *,
    skip_header_rows: int = 0,
    swap_xy: bool = False,
    z_flip: bool = False,
    unit_scale: float = 1.0,
    col_x: int = 0,
    col_y: int = 1,
    col_z: int = 2,
) -> np.ndarray:
    """Parse construction/survey CSV (TREND-POINT 施工履歴データ)."""
    rows: list[list[float]] = []
    lines = text.splitlines()
    for i, raw in enumerate(lines):
        if i < skip_header_rows:
            continue
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.replace(",", " ").split()
        if len(parts) <= max(col_x, col_y, col_z):
            continue
        try:
            x = float(parts[col_x]) * unit_scale
            y = float(parts[col_y]) * unit_scale
            z = float(parts[col_z]) * unit_scale
            if z_flip:
                z = -z
            if swap_xy:
                x, y = y, x
            rows.append([x, y, z])
        except ValueError:
            continue
    if not rows:
        raise ValueError("Không đọc được điểm từ CSV")
    return np.asarray(rows, dtype=np.float32)
