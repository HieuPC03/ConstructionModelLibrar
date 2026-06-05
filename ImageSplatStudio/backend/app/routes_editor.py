"""Point cloud editor API routes."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from app.services.pointcloud_editor import (
    add_breakline,
    add_coord_point,
    add_measurement,
    add_point_at,
    add_hidden_region,
    apply_density_filter,
    apply_ground_filter,
    clean_outliers,
    clear_hidden_regions,
    clip_box,
    configure_grid,
    configure_view,
    create_mesh,
    delete_breakline,
    delete_hidden_region,
    delete_measurement,
    delete_points_at,
    export_session,
    get_grid_binary,
    get_properties,
    mesh_add_vertex,
    mesh_delete_vertex,
    polygon_delete,
    redo_session,
    set_file_visibility,
    show_all,
    split_session,
    toggle_swap_xy,
    undo_session,
)
from app.services.preview_cache import get_session

router = APIRouter(prefix="/api/pointcloud-editor")


class VisibilityBody(BaseModel):
    file_index: int
    visible: bool


class RegionBody(BaseModel):
    min: list[float] = Field(..., min_length=3, max_length=3)
    max: list[float] = Field(..., min_length=3, max_length=3)


class GridBody(BaseModel):
    enabled: bool = True
    cell_size: float = Field(1.0, gt=0)
    region_min: list[float] | None = None
    region_max: list[float] | None = None
    create_data: bool = False
    clear_region: bool = False


class SplitBody(BaseModel):
    axis: int = Field(..., ge=0, le=2)
    value: float


class MeshBody(BaseModel):
    method: str = "poisson"


class PointBody(BaseModel):
    position: list[float] = Field(..., min_length=3, max_length=3)
    radius: float = Field(0.02, gt=0)


class MeshVertexBody(BaseModel):
    position: list[float] = Field(..., min_length=3, max_length=3)


class MeshVertexIndexBody(BaseModel):
    vertex_index: int = Field(..., ge=0)


class BreaklineBody(BaseModel):
    points: list[list[float]] = Field(..., min_length=2)


class ClipBoxBody(BaseModel):
    min: list[float] = Field(..., min_length=3, max_length=3)
    max: list[float] = Field(..., min_length=3, max_length=3)
    mode: Literal["inside", "outside"] = "inside"


class PolygonBody(BaseModel):
    polygon: list[list[float]] = Field(..., min_length=3)


class FilterDensityBody(BaseModel):
    radius: float = Field(0.05, gt=0)
    min_neighbors: int = Field(5, ge=1)


class FilterGroundBody(BaseModel):
    cell_size: float = Field(1.0, gt=0)
    max_offset: float = Field(0.5, gt=0)


class CoordPointBody(BaseModel):
    position: list[float] = Field(..., min_length=3, max_length=3)
    label: str = ""


class MeasurementBody(BaseModel):
    type: Literal["distance", "area"]
    points: list[list[float]] = Field(..., min_length=2)
    value: float
    unit: str = "m"


class IdBody(BaseModel):
    id: str


class ViewSettingsBody(BaseModel):
    crs_epsg: int | None = None
    basemap_enabled: bool | None = None
    basemap_mode: str | None = None
    show_axes: bool | None = None


def _ensure_session(session_id: str) -> None:
    if get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Phiên preview đã hết hạn.")


@router.get("/{session_id}/properties")
def editor_properties(session_id: str) -> dict:
    _ensure_session(session_id)
    try:
        return get_properties(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/swap-xy")
def editor_swap_xy(session_id: str) -> dict:
    _ensure_session(session_id)
    return toggle_swap_xy(session_id)


@router.post("/{session_id}/visibility")
def editor_visibility(session_id: str, body: VisibilityBody) -> dict:
    _ensure_session(session_id)
    return set_file_visibility(session_id, body.file_index, body.visible)


@router.post("/{session_id}/show-all")
def editor_show_all(session_id: str) -> dict:
    _ensure_session(session_id)
    return show_all(session_id)


@router.post("/{session_id}/hide-region")
def editor_hide_region(session_id: str, body: RegionBody) -> dict:
    _ensure_session(session_id)
    return add_hidden_region(session_id, body.min, body.max)


@router.post("/{session_id}/clear-regions")
def editor_clear_regions(session_id: str) -> dict:
    _ensure_session(session_id)
    return clear_hidden_regions(session_id)


@router.post("/{session_id}/clean-outliers")
def editor_clean(session_id: str) -> dict:
    _ensure_session(session_id)
    try:
        return clean_outliers(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/split")
def editor_split(session_id: str, body: SplitBody) -> dict:
    _ensure_session(session_id)
    try:
        return split_session(session_id, body.axis, body.value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/grid")
def editor_grid(session_id: str, body: GridBody) -> dict:
    _ensure_session(session_id)
    try:
        return configure_grid(
            session_id,
            enabled=body.enabled,
            cell_size=body.cell_size,
            region_min=body.region_min,
            region_max=body.region_max,
            create_data=body.create_data,
            clear_region=body.clear_region,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{session_id}/grid")
def editor_grid_data(session_id: str) -> Response:
    _ensure_session(session_id)
    data = get_grid_binary(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Grid chưa bật.")
    return Response(content=data, media_type="application/octet-stream")


@router.post("/{session_id}/mesh")
def editor_mesh(session_id: str, body: MeshBody) -> dict:
    _ensure_session(session_id)
    method = body.method if body.method in {"poisson", "bpa"} else "poisson"
    try:
        return create_mesh(session_id, method=method)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{session_id}/mesh.obj")
def editor_mesh_download(session_id: str) -> FileResponse:
    _ensure_session(session_id)
    from app.services.pointcloud_editor import get_mesh_path

    try:
        mesh_path = get_mesh_path(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path=mesh_path, media_type="model/obj", filename="mesh.obj")


@router.get("/{session_id}/export/las")
def editor_export_las(session_id: str) -> FileResponse:
    _ensure_session(session_id)
    try:
        path = export_session(session_id, "las")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(path=path, media_type="application/octet-stream", filename="pointcloud.las")


@router.get("/{session_id}/export/txt")
def editor_export_txt(session_id: str) -> FileResponse:
    _ensure_session(session_id)
    try:
        path = export_session(session_id, "txt")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(path=path, media_type="text/plain", filename="pointcloud.txt")


@router.post("/{session_id}/points/delete")
def editor_delete_points(session_id: str, body: PointBody) -> dict:
    _ensure_session(session_id)
    try:
        return delete_points_at(session_id, body.position, body.radius)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/points/add")
def editor_add_point(session_id: str, body: MeshVertexBody) -> dict:
    _ensure_session(session_id)
    return add_point_at(session_id, body.position)


@router.post("/{session_id}/breakline")
def editor_breakline(session_id: str, body: BreaklineBody) -> dict:
    _ensure_session(session_id)
    try:
        return add_breakline(session_id, body.points)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/mesh/vertex/add")
def editor_mesh_vertex_add(session_id: str, body: MeshVertexBody) -> dict:
    _ensure_session(session_id)
    try:
        return mesh_add_vertex(session_id, body.position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/mesh/vertex/delete")
def editor_mesh_vertex_delete(session_id: str, body: MeshVertexIndexBody) -> dict:
    _ensure_session(session_id)
    try:
        return mesh_delete_vertex(session_id, body.vertex_index)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/clip-box")
def editor_clip_box(session_id: str, body: ClipBoxBody) -> dict:
    _ensure_session(session_id)
    try:
        return clip_box(session_id, body.min, body.max, mode=body.mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/polygon-delete")
def editor_polygon_delete(session_id: str, body: PolygonBody) -> dict:
    _ensure_session(session_id)
    try:
        return polygon_delete(session_id, body.polygon)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/filter/density")
def editor_filter_density(session_id: str, body: FilterDensityBody) -> dict:
    _ensure_session(session_id)
    try:
        return apply_density_filter(session_id, body.radius, body.min_neighbors)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/filter/ground")
def editor_filter_ground(session_id: str, body: FilterGroundBody) -> dict:
    _ensure_session(session_id)
    try:
        return apply_ground_filter(session_id, body.cell_size, body.max_offset)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/coord-point")
def editor_coord_point(session_id: str, body: CoordPointBody) -> dict:
    _ensure_session(session_id)
    return add_coord_point(session_id, body.position, body.label)


@router.post("/{session_id}/measurement")
def editor_measurement(session_id: str, body: MeasurementBody) -> dict:
    _ensure_session(session_id)
    return add_measurement(session_id, body.type, body.points, body.value, body.unit)


@router.post("/{session_id}/breakline/delete")
def editor_breakline_delete(session_id: str, body: IdBody) -> dict:
    _ensure_session(session_id)
    return delete_breakline(session_id, body.id)


@router.post("/{session_id}/region/delete")
def editor_region_delete(session_id: str, body: IdBody) -> dict:
    _ensure_session(session_id)
    return delete_hidden_region(session_id, body.id)


@router.post("/{session_id}/measurement/delete")
def editor_measurement_delete(session_id: str, body: IdBody) -> dict:
    _ensure_session(session_id)
    return delete_measurement(session_id, body.id)


@router.post("/{session_id}/view")
def editor_view_settings(session_id: str, body: ViewSettingsBody) -> dict:
    _ensure_session(session_id)
    return configure_view(
        session_id,
        crs_epsg=body.crs_epsg,
        basemap_enabled=body.basemap_enabled,
        basemap_mode=body.basemap_mode,
        show_axes=body.show_axes,
    )


@router.post("/{session_id}/undo")
def editor_undo(session_id: str) -> dict:
    _ensure_session(session_id)
    try:
        return undo_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/redo")
def editor_redo(session_id: str) -> dict:
    _ensure_session(session_id)
    try:
        return redo_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
