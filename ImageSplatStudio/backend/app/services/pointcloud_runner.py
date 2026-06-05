import shutil
import subprocess
import threading
from pathlib import Path

from app.config import settings
from app.models import JobProgress, JobStatus, OutputFormat
from app.services.job_store import job_store

PIPELINE_ROOT = Path(__file__).resolve().parents[3] / "pipeline"
DEMO_POINTCLOUD = PIPELINE_ROOT / "demo" / "demo_pointcloud.ply"
MESH_SCRIPT = PIPELINE_ROOT / "pointcloud_to_mesh.py"


class PointCloudRunner:
    def __init__(self) -> None:
        self._running: set[str] = set()
        self._lock = threading.Lock()

    def start(self, job_id: str) -> None:
        with self._lock:
            if job_id in self._running:
                return
            self._running.add(job_id)

        thread = threading.Thread(target=self._run, args=(job_id,), daemon=True)
        thread.start()

    def _run(self, job_id: str) -> None:
        try:
            job = job_store.get(job_id)
            if job is None:
                return

            upload_dir = job_store.job_dir(job_id, "uploads")
            output_dir = job_store.job_dir(job_id, "outputs")
            input_files = self._find_pointclouds(upload_dir)

            if not input_files and not job.demo:
                job_store.update(
                    job_id,
                    status=JobStatus.FAILED,
                    error="Không tìm thấy file point cloud hợp lệ.",
                    progress=JobProgress(
                        stage=JobStatus.FAILED,
                        percent=0,
                        message="File không hợp lệ.",
                    ),
                )
                return

            input_path = input_files[0] if input_files else DEMO_POINTCLOUD
            if job.demo and not input_files:
                shutil.copy2(DEMO_POINTCLOUD, upload_dir / "demo_pointcloud.ply")
                input_path = upload_dir / "demo_pointcloud.ply"

            method = job.mesh_method or "poisson"
            output_path = output_dir / "model.obj"

            job_store.update(
                job_id,
                status=JobStatus.PREPROCESSING,
                progress=JobProgress(
                    stage=JobStatus.PREPROCESSING,
                    percent=10,
                    message="Đang đọc point cloud...",
                ),
            )

            cmd = [
                "python3",
                str(MESH_SCRIPT),
                "--input",
                str(input_path),
                "--output",
                str(output_path),
                "--method",
                method,
            ]

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=str(PIPELINE_ROOT),
            )

            stage_map = {
                "STAGE:PREPROCESS": (JobStatus.PREPROCESSING, 25, "Đang tiền xử lý point cloud..."),
                "STAGE:MESHING": (JobStatus.MESHING, 60, "Đang tạo mesh 3D (Poisson)..."),
                "STAGE:EXPORT": (JobStatus.EXPORTING, 90, "Đang xuất file mesh..."),
            }

            assert process.stdout is not None
            for line in process.stdout:
                line = line.strip()
                for marker, (stage, percent, message) in stage_map.items():
                    if marker in line:
                        job_store.update(
                            job_id,
                            status=stage,
                            progress=JobProgress(stage=stage, percent=percent, message=message),
                        )
                        break

            return_code = process.wait()
            if return_code != 0 or not output_path.exists():
                raise RuntimeError("Tạo mesh thất bại. Kiểm tra định dạng point cloud.")

            job_store.update(
                job_id,
                status=JobStatus.COMPLETED,
                output_url=f"/api/jobs/{job_id}/model.obj",
                progress=JobProgress(
                    stage=JobStatus.COMPLETED,
                    percent=100,
                    message="Hoàn tất! Mesh 3D đã sẵn sàng.",
                ),
            )
        except Exception as exc:
            job_store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(exc),
                progress=JobProgress(
                    stage=JobStatus.FAILED,
                    percent=0,
                    message=f"Lỗi: {exc}",
                ),
            )
        finally:
            with self._lock:
                self._running.discard(job_id)

    def _find_pointclouds(self, upload_dir: Path) -> list[Path]:
        if not upload_dir.exists():
            return []
        return sorted(
            p
            for p in upload_dir.iterdir()
            if p.is_file() and p.suffix.lower() in settings.pointcloud_extensions
        )


pointcloud_runner = PointCloudRunner()
