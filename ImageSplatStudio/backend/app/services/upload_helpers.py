from pathlib import Path

from app.config import settings

MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/tiff": ".tif",
    "image/x-tiff": ".tif",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/x-ms-bmp": ".bmp",
}


def resolve_image_suffix(filename: str | None, content_type: str | None) -> str | None:
    suffix = Path(filename or "").suffix.lower()
    if suffix in settings.allowed_extensions:
        return suffix

    mime = (content_type or "").split(";")[0].strip().lower()
    ext = MIME_TO_EXT.get(mime)
    if ext and ext in settings.allowed_extensions:
        return ext

    return None


def supported_image_formats_hint() -> str:
    return ", ".join(sorted(ext.lstrip(".") for ext in settings.allowed_extensions))
