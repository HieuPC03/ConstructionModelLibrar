import shutil
import subprocess
import threading
from pathlib import Path

from app.config import PIPELINE_DIR, settings
from app.models import JobProgress, JobStatus, OutputFormat
from app.services.job_store import job_store

PIPELINE_ROOT = PIPELINE_DIR
DEMO_POINTCLOUD = PIPELINE_ROOT / "demo" / "demo_pointcloud.ply"
DEMO_SPLAT = PIPELINE_ROOT / "demo" / "demo.splat"
GAUSSIAN_SCRIPT = PIPELINE_ROOT / "pointcloud_to_gaussian.py"


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
                if DEMO_POINTCLOUD.exists():
                    shutil.copy2(DEMO_POINTCLOUD, upload_dir / "demo_pointcloud.ply")
                    input_path = upload_dir / "demo_pointcloud.ply"
                elif DEMO_SPLAT.exists():
                    shutil.copy2(DEMO_SPLAT, output_dir / "model.splat")
                    job_store.update(
                        job_id,
                        status=JobStatus.COMPLETED,
                        output_url=f"/api/jobs/{job_id}/model.splat",
                        progress=JobProgress(
                            stage=JobStatus.COMPLETED,
                            percent=100,
                            message="Hoàn tất! Hình khối 3D Gaussian sẵn sàng.",
                        ),
                    )
                    return

            mode = job.mesh_method if job.mesh_method in {"luma", "standard"} else "luma"
            output_path = output_dir / "model.splat"

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
                str(GAUSSIAN_SCRIPT),
                "--input",
                str(input_path),
                "--output",
                str(output_path),
                "--mode",
                mode,
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
                "STAGE:TRAINING": (JobStatus.TRAINING, 65, "Đang tạo Gaussian 3D (kiểu Luma AI)..."),
                "STAGE:EXPORT": (JobStatus.EXPORTING, 90, "Đang xuất hình khối 3D (.splat)..."),
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
                raise RuntimeError("Tạo hình khối 3D thất bại. Kiểm tra định dạng point cloud.")

            job_store.update(
                job_id,
                status=JobStatus.COMPLETED,
                output_url=f"/api/jobs/{job_id}/model.splat",
                progress=JobProgress(
                    stage=JobStatus.COMPLETED,
                    percent=100,
                    message="Hoàn tất! Hình khối 3D Gaussian sẵn sàng.",
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
