from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routes import router
from app.routes_basemap import router as basemap_router
from app.routes_editor import router as editor_router

app = FastAPI(
    title=settings.app_name,
    description="Tạo mô hình 3D Gaussian Splatting từ bộ ảnh",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(editor_router)
app.include_router(basemap_router)

frontend_dist = settings.frontend_dir
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
