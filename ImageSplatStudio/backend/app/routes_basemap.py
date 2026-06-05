"""Proxy GSI map tiles (avoids CORS in Electron/browser)."""

from __future__ import annotations

import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/api/basemap")

GSI_URLS = {
    "aerial": "https://cyberjapandrs.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    "road": "https://cyberjapandrs.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    "hybrid_photo": "https://cyberjapandrs.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    "hybrid_road": "https://cyberjapandrs.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
}

CONTENT_TYPES = {
    "aerial": "image/jpeg",
    "road": "image/png",
    "hybrid_photo": "image/jpeg",
    "hybrid_road": "image/png",
}


@router.get("/tile/{mode}/{z}/{x}/{y}")
def basemap_tile(mode: str, z: int, x: int, y: int) -> Response:
    if mode not in GSI_URLS:
        raise HTTPException(status_code=400, detail="Invalid basemap mode")
    if z < 0 or z > 20 or x < 0 or y < 0:
        raise HTTPException(status_code=400, detail="Invalid tile coordinates")

    url = GSI_URLS[mode].format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": "ImageSplatStudio/0.7"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail="Tile not found") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail="Tile fetch failed") from exc

    return Response(
        content=data,
        media_type=CONTENT_TYPES.get(mode, "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=86400"},
    )
