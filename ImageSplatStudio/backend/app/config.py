from pathlib import Path
import os

from pydantic_settings import BaseSettings


def _default_data_dir() -> Path:
    env = os.environ.get("SPLAT_DATA_DIR")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2] / "data"


def _default_frontend_dir() -> Path:
    env = os.environ.get("SPLAT_FRONTEND_DIR")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _default_app_root() -> Path:
    env = os.environ.get("SPLAT_APP_ROOT")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "ImageSplat Studio"
    app_version: str = "0.14.1"
    data_dir: Path = _default_data_dir()
    frontend_dir: Path = _default_frontend_dir()
    app_root: Path = _default_app_root()
    demo_mode: bool = False
    max_upload_images: int = 200
    max_upload_size_mb: int = 500
    allowed_extensions: set[str] = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
    pointcloud_extensions: set[str] = {
        ".ply", ".pcd", ".xyz", ".pts", ".las", ".laz", ".txt", ".obj", ".e57",
    }

    class Config:
        env_prefix = "SPLAT_"


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
(settings.data_dir / "jobs").mkdir(parents=True, exist_ok=True)
(settings.data_dir / "uploads").mkdir(parents=True, exist_ok=True)
(settings.data_dir / "outputs").mkdir(parents=True, exist_ok=True)

PIPELINE_DIR = settings.app_root / "pipeline"
