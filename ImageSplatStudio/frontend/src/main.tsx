import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createJob,
  createPointCloudJob,
  deleteJob,
  fetchHealth,
  fetchJob,
  fetchJobs,
  modelUrl,
} from "./api";
import { ExportBar } from "./components/ExportBar";
import { JobList } from "./components/JobList";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { Logo } from "./components/Logo";
import { PointCloudPanel } from "./components/PointCloudPanel";
import { SplatViewer } from "./components/SplatViewer";
import { UploadPanel } from "./components/UploadPanel";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import type { AppMode, HealthInfo, JobInfo } from "./types";
import "./styles.css";

function AppContent() {
  const { tr } = useI18n();
  const [mode, setMode] = useState<AppMode>("pointcloud");
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

  const handleImageSubmit = async (name: string, files: File[], demo: boolean) => {
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

  const handlePointCloudSubmit = async (
    name: string,
    file: File | null,
    demo: boolean,
    method: "luma" | "standard",
  ) => {
    setBusy(true);
    setError(null);
    try {
      const result = await createPointCloudJob(name, file, demo, method);
      await refresh();
      setSelectedId(result.job_id);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm(tr("confirmDelete"))) return;
    await deleteJob(jobId);
    if (selectedId === jobId) setSelectedId(null);
    await refresh();
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <Logo size={44} />
          <div>
            <p className="eyebrow">{tr("appTagline")}</p>
            <h1>{tr("appTitle")}</h1>
          </div>
        </div>
        <div className="header-actions">
          <LanguageSwitcher />
          <div className="status-pills">
            <span className={`pill ${health?.open3d_available ? "pill-ok" : "pill-warn"}`}>
              {tr("statusOpen3d")} {health?.open3d_available ? tr("statusOk") : tr("statusNa")}
            </span>
            <span className={`pill ${health?.gpu_available ? "pill-ok" : "pill-warn"}`}>
              {tr("statusGpu")} {health?.gpu_available ? tr("statusOk") : tr("statusNa")}
            </span>
          </div>
        </div>
      </header>

      <div className="mode-tabs">
        <button
          type="button"
          className={`mode-tab ${mode === "pointcloud" ? "active" : ""}`}
          onClick={() => setMode("pointcloud")}
        >
          {tr("tabPointCloud")}
        </button>
        <button
          type="button"
          className={`mode-tab ${mode === "images" ? "active" : ""}`}
          onClick={() => setMode("images")}
        >
          {tr("tabImages")}
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <main className="layout">
        <aside className="sidebar">
          {mode === "pointcloud" ? (
            <PointCloudPanel
              onSubmit={handlePointCloudSubmit}
              busy={busy}
              open3dAvailable={!!health?.open3d_available}
            />
          ) : (
            <UploadPanel
              onSubmit={handleImageSubmit}
              busy={busy}
              demoMode={!!health?.demo_mode}
            />
          )}
          <JobList
            jobs={jobs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </aside>

        <section className="viewer-section panel">
          <div className="viewer-header">
            <h2>{tr("viewerTitle")}</h2>
            {selectedJob && (
              <p className="muted">
                {selectedJob.name} — {selectedJob.progress.message}
              </p>
            )}
          </div>

          {selectedJob?.status === "completed" ? (
            <>
              <ExportBar job={selectedJob} />
              <SplatViewer url={modelUrl(selectedJob)} />
            </>
          ) : (
            <div className="viewer-placeholder">
              {selectedJob ? (
                <>
                  <div className="spinner" />
                  <p>{selectedJob.progress.message}</p>
                  <p className="muted">{Math.round(selectedJob.progress.percent)}%</p>
                </>
              ) : (
                <p className="muted">
                  {mode === "pointcloud" ? tr("viewerEmptyPc") : tr("viewerEmptyImages")}
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
