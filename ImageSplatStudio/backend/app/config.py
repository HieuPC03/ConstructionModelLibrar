from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ImageSplat Studio"
    data_dir: Path = Path(__file__).resolve().parents[2] / "data"
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
