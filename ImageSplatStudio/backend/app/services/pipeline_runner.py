import shutil
import subprocess
import threading
import time
from pathlib import Path

from app.config import settings
from app.models import JobProgress, JobStatus
from app.services.job_store import check_colmap_available, check_gpu_available, job_store

PIPELINE_ROOT = Path(__file__).resolve().parents[3] / "pipeline"
DEMO_SPLAT = PIPELINE_ROOT / "demo" / "demo.splat"


class PipelineRunner:
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
            images = sorted(
                p
                for p in upload_dir.iterdir()
                if p.suffix.lower() in settings.allowed_extensions
            )

            if len(images) < 3 and not job.demo:
                job_store.update(
                    job_id,
                    status=JobStatus.FAILED,
                    error="Cần ít nhất 3 ảnh để tạo mô hình 3D.",
                    progress=JobProgress(
                        stage=JobStatus.FAILED,
                        percent=0,
                        message="Không đủ ảnh đầu vào.",
                    ),
                )
                return

            use_demo = settings.demo_mode or job.demo or not check_gpu_available()
            if use_demo:
                self._run_demo(job_id, output_dir)
                return

            self._run_full_pipeline(job_id, upload_dir, output_dir)
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

    def _run_demo(self, job_id: str, output_dir: Path) -> None:
        stages = [
            (JobStatus.PREPROCESSING, 15, "Đang chuẩn bị ảnh..."),
            (JobStatus.COLMAP, 35, "Đang ước lượng camera (demo)..."),
            (JobStatus.TRAINING, 70, "Đang huấn luyện Gaussian Splatting (demo)..."),
            (JobStatus.EXPORTING, 90, "Đang xuất mô hình .splat..."),
        ]
        for stage, percent, message in stages:
            job_store.update(
                job_id,
                status=stage,
                progress=JobProgress(stage=stage, percent=percent, message=message),
            )
            time.sleep(1.2)

        output_path = output_dir / "model.splat"
        if DEMO_SPLAT.exists():
            shutil.copy2(DEMO_SPLAT, output_path)
        else:
            self._write_minimal_splat(output_path)

        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            output_url=f"/api/jobs/{job_id}/model.splat",
            progress=JobProgress(
                stage=JobStatus.COMPLETED,
                percent=100,
                message="Hoàn tất! (Chế độ demo — cần GPU để huấn luyện thật)",
            ),
        )

    def _run_full_pipeline(self, job_id: str, upload_dir: Path, output_dir: Path) -> None:
        script = PIPELINE_ROOT / "run_pipeline.sh"
        if not script.exists():
            raise FileNotFoundError(f"Pipeline script not found: {script}")

        job_store.update(
            job_id,
            status=JobStatus.PREPROCESSING,
            progress=JobProgress(
                stage=JobStatus.PREPROCESSING,
                percent=5,
                message="Đang chuẩn bị dữ liệu...",
            ),
        )

        env = {
            **dict(__import__("os").environ),
            "JOB_ID": job_id,
            "INPUT_DIR": str(upload_dir),
            "OUTPUT_DIR": str(output_dir),
        }

        process = subprocess.Popen(
            ["bash", str(script)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            cwd=str(PIPELINE_ROOT),
        )

        stage_map = {
            "STAGE:COLMAP": (JobStatus.COLMAP, 30, "Đang chạy COLMAP (Structure from Motion)..."),
            "STAGE:TRAINING": (JobStatus.TRAINING, 60, "Đang huấn luyện 3D Gaussian Splatting..."),
            "STAGE:EXPORT": (JobStatus.EXPORTING, 90, "Đang xuất file .splat..."),
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
        output_file = output_dir / "model.splat"
        if return_code != 0 or not output_file.exists():
            raise RuntimeError("Pipeline thất bại. Kiểm tra log server.")

        job_store.update(
            job_id,
            status=JobStatus.COMPLETED,
            output_url=f"/api/jobs/{job_id}/model.splat",
            progress=JobProgress(
                stage=JobStatus.COMPLETED,
                percent=100,
                message="Hoàn tất! Mô hình 3D đã sẵn sàng.",
            ),
        )

    def _write_minimal_splat(self, path: Path) -> None:
        if DEMO_SPLAT.exists():
            shutil.copy2(DEMO_SPLAT, path)


pipeline_runner = PipelineRunner()
