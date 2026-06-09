"""Proxy GSI map tiles and stitch service."""

from __future__ import annotations

import io
import math
import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from PIL import Image

router = APIRouter(prefix="/api/basemap")

GSI_URLS = {
    "aerial": "https://cyberjapandrs.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    "road": "https://cyberjapandrs.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    "hybrid_photo": "https://cyberjapandrs.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    "hybrid_road": "https://cyberjapandrs.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
}


def _fetch_tile(mode: str, z: int, x: int, y: int) -> bytes | None:
    if mode not in GSI_URLS:
        return None
    url = GSI_URLS[mode].format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": "ImageSplatStudio/0.7"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None


def _lonlat_to_tile(lon: float, lat: float, zoom: int) -> tuple[int, int]:
    n = 2**zoom
    tx = int(math.floor((lon + 180.0) / 360.0 * n))
    lat_rad = math.radians(lat)
    ty = int(math.floor((1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n))
    return tx, ty


def _pick_zoom(lon_span: float, lat_span: float) -> int:
    span = max(lon_span, lat_span, 1e-6)
    if span > 2:
        return 10
    if span > 0.5:
        return 12
    if span > 0.1:
        return 14
    if span > 0.02:
        return 15
    if span > 0.005:
        return 16
    return 17


@router.get("/tile/{mode}/{z}/{x}/{y}")
def basemap_tile(mode: str, z: int, x: int, y: int) -> Response:
    if mode not in GSI_URLS:
        raise HTTPException(status_code=400, detail="Invalid basemap mode")
    if z < 0 or z > 20 or x < 0 or y < 0:
        raise HTTPException(status_code=400, detail="Invalid tile coordinates")

    data = _fetch_tile(mode, z, x, y)
    if data is None:
        raise HTTPException(status_code=502, detail="Tile fetch failed")

    media = "image/png" if mode in ("road", "hybrid_road") else "image/jpeg"
    return Response(content=data, media_type=media, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/stitch")
def basemap_stitch(
    min_lon: float = Query(...),
    min_lat: float = Query(...),
    max_lon: float = Query(...),
    max_lat: float = Query(...),
    mode: str = Query("aerial"),
) -> Response:
    """Stitch GSI tiles for a WGS84 bounding box into one JPEG."""
    if mode not in ("aerial", "road", "hybrid"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    if min_lon >= max_lon or min_lat >= max_lat:
        raise HTTPException(status_code=400, detail="Invalid bounds")

    zoom = _pick_zoom(max_lon - min_lon, max_lat - min_lat)
    t_min_x, t_max_y = _lonlat_to_tile(min_lon, max_lat, zoom)
    t_max_x, t_min_y = _lonlat_to_tile(max_lon, min_lat, zoom)

    tile_w = t_max_x - t_min_x + 1
    tile_h = t_max_y - t_min_y + 1
    if tile_w <= 0 or tile_h <= 0 or tile_w > 24 or tile_h > 24:
        raise HTTPException(status_code=400, detail="Area too large for tile stitch")

    tile_size = 256
    canvas = Image.new("RGB", (tile_w * tile_size, tile_h * tile_size), (42, 52, 68))
    loaded = 0

    base_mode = "aerial" if mode in ("aerial", "hybrid") else "road"
    for ty in range(t_min_y, t_max_y + 1):
        for tx in range(t_min_x, t_max_x + 1):
            raw = _fetch_tile(base_mode, zoom, tx, ty)
            if raw is None:
                continue
            try:
                tile = Image.open(io.BytesIO(raw)).convert("RGBA" if base_mode == "road" else "RGB")
                dx = (tx - t_min_x) * tile_size
                dy = (ty - t_min_y) * tile_size
                if base_mode == "road":
                    canvas.paste(tile, (dx, dy), tile)
                else:
                    canvas.paste(tile, (dx, dy))
                loaded += 1
                if mode == "hybrid":
                    road_raw = _fetch_tile("hybrid_road", zoom, tx, ty)
                    if road_raw:
                        road = Image.open(io.BytesIO(road_raw)).convert("RGBA")
                        canvas.paste(road, (dx, dy), road)
            except OSError:
                continue

    if loaded == 0:
        raise HTTPException(status_code=502, detail="No tiles loaded")

    out = io.BytesIO()
    canvas.convert("RGB").save(out, format="JPEG", quality=88)
    return Response(
        content=out.getvalue(),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )
