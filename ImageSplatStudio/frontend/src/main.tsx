import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createJob,
  deleteJob,
  fetchHealth,
  fetchJob,
  fetchJobs,
  modelUrl,
} from "./api";
import { JobList } from "./components/JobList";
import { SplatViewer } from "./components/SplatViewer";
import { UploadPanel } from "./components/UploadPanel";
import type { HealthInfo, JobInfo } from "./types";
import "./styles.css";

function App() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = jobs.find((j) => j.job_id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    const [h, list] = await Promise.all([fetchHealth(), fetchJobs()]);
    setHealth(h);
    setJobs(list);
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].job_id);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh().catch((e: unknown) => setError(String(e)));
  }, [refresh]);

  useEffect(() => {
    const active = jobs.some(
      (j) => !["completed", "failed", "cancelled"].includes(j.status),
    );
    if (!active) return;
    const timer = setInterval(() => {
      fetchJobs()
        .then(setJobs)
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [jobs]);

  useEffect(() => {
    if (!selectedId) return;
    const job = jobs.find((j) => j.job_id === selectedId);
    if (job?.status === "completed") return;
    const timer = setInterval(() => {
      fetchJob(selectedId)
        .then((updated) => {
          setJobs((prev) =>
            prev.map((j) => (j.job_id === updated.job_id ? updated : j)),
          );
        })
        .catch(() => undefined);
    }, 1500);
    return () => clearInterval(timer);
  }, [selectedId, jobs]);

  const handleSubmit = async (name: string, files: File[], demo: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await createJob(name, files, demo);
      await refresh();
      setSelectedId(result.job_id);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Xóa job này?")) return;
    await deleteJob(jobId);
    if (selectedId === jobId) setSelectedId(null);
    await refresh();
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">3D Gaussian Splatting</p>
          <h1>ImageSplat Studio</h1>
        </div>
        <div className="status-pills">
          <span className={`pill ${health?.gpu_available ? "pill-ok" : "pill-warn"}`}>
            GPU {health?.gpu_available ? "OK" : "N/A"}
          </span>
          <span className={`pill ${health?.colmap_available ? "pill-ok" : "pill-warn"}`}>
            COLMAP {health?.colmap_available ? "OK" : "N/A"}
          </span>
        </div>
      </header>

      {error && <div className="banner banner-error">{error}</div>}

      <main className="layout">
        <aside className="sidebar">
          <UploadPanel onSubmit={handleSubmit} busy={busy} demoMode={!!health?.demo_mode} />
          <JobList
            jobs={jobs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </aside>

        <section className="viewer-section panel">
          <div className="viewer-header">
            <h2>Xem mô hình 3D</h2>
            {selectedJob && (
              <p className="muted">
                {selectedJob.name} — {selectedJob.progress.message}
              </p>
            )}
          </div>

          {selectedJob?.status === "completed" ? (
            <SplatViewer url={modelUrl(selectedJob.job_id)} />
          ) : (
            <div className="viewer-placeholder">
              {selectedJob ? (
                <>
                  <div className="spinner" />
                  <p>{selectedJob.progress.message}</p>
                  <p className="muted">{Math.round(selectedJob.progress.percent)}%</p>
                </>
              ) : (
                <p className="muted">Chọn hoặc tạo một dự án để xem kết quả 3D.</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
