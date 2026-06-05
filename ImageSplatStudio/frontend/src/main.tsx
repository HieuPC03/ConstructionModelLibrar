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
import { PointCloudMenuBar } from "./components/PointCloudMenuBar";
import { PointCloudPanel } from "./components/PointCloudPanel";
import { PointCloudPreview } from "./components/PointCloudPreview";
import { PointCloudPropertyTable } from "./components/PointCloudPropertyTable";
import { SplatViewer } from "./components/SplatViewer";
import { UploadPanel } from "./components/UploadPanel";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import { fetchEditorProperties, type EditorProperties } from "./api/editor";
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
  const [pcPreviewFiles, setPcPreviewFiles] = useState<File[]>([]);
  const [pcSessionId, setPcSessionId] = useState<string | null>(null);
  const [editorProperties, setEditorProperties] = useState<EditorProperties | null>(null);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [gridCellSize, setGridCellSize] = useState(1.0);

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
    if (job?.status === "completed") {
      setPcPreviewFiles([]);
      return;
    }
    const timer = setInterval(() => {
      fetchJob(selectedId)
        .then((updated) => {
          setJobs((prev) =>
            prev.map((j) => (j.job_id === updated.job_id ? updated : j)),
          );
          if (updated.status === "completed" || updated.status === "failed") {
            setPcPreviewFiles([]);
          }
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
      setPcPreviewFiles([]);
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
    files: File[],
    demo: boolean,
    method: "luma" | "standard",
  ) => {
    setBusy(true);
    setError(null);
    try {
      const result = await createPointCloudJob(name, files, demo, method);
      setPcPreviewFiles([]);
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

  const handlePointCloudFilesChange = (files: File[]) => {
    setPcPreviewFiles(files);
    setPcSessionId(null);
    setEditorProperties(null);
    if (files.length > 0) setSelectedId(null);
  };

  const handleSessionReady = async (sessionId: string) => {
    setPcSessionId(sessionId);
    try {
      const props = await fetchEditorProperties(sessionId);
      setEditorProperties(props);
      if (props.grid.cell_size) setGridCellSize(props.grid.cell_size);
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const bumpPreview = () => setPreviewRefresh((n) => n + 1);

  const handleEditorUpdated = (props: EditorProperties) => {
    setEditorProperties(props);
    if (props.grid.cell_size) setGridCellSize(props.grid.cell_size);
  };

  const showPointCloudPreview =
    mode === "pointcloud" &&
    pcPreviewFiles.length > 0 &&
    !selectedJob;

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

      {mode === "pointcloud" && showPointCloudPreview && (
        <PointCloudMenuBar
          sessionId={pcSessionId}
          properties={editorProperties}
          onUpdated={handleEditorUpdated}
          onRefreshPreview={bumpPreview}
          onError={setError}
        />
      )}

      {error && <div className="banner banner-error">{error}</div>}

      <main className="layout">
        <aside className="sidebar">
          {mode === "pointcloud" ? (
            <>
              <PointCloudPanel
                onSubmit={handlePointCloudSubmit}
                onFilesChange={handlePointCloudFilesChange}
                busy={busy}
                open3dAvailable={!!health?.open3d_available}
              />
              {pcPreviewFiles.length > 0 && (
                <PointCloudPropertyTable
                  sessionId={pcSessionId}
                  properties={editorProperties}
                  gridCellSize={gridCellSize}
                  onGridCellSizeChange={setGridCellSize}
                  onUpdated={handleEditorUpdated}
                  onRefreshPreview={bumpPreview}
                  onError={setError}
                />
              )}
            </>
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
            onSelect={(id) => {
              setSelectedId(id);
              setPcPreviewFiles([]);
            }}
            onDelete={handleDelete}
          />
        </aside>

        <section className="viewer-section panel">
          {!showPointCloudPreview && (
            <div className="viewer-header">
              <h2>{tr("viewerTitle")}</h2>
              {selectedJob && (
                <p className="muted">
                  {selectedJob.name} — {selectedJob.progress.message}
                </p>
              )}
            </div>
          )}

          {selectedJob?.status === "completed" ? (
            <>
              <ExportBar job={selectedJob} />
              <SplatViewer url={modelUrl(selectedJob)} />
            </>
          ) : showPointCloudPreview ? (
            <PointCloudPreview
              files={pcPreviewFiles}
              refreshToken={previewRefresh}
              gridEnabled={!!editorProperties?.grid.enabled}
              showMesh={!!editorProperties?.mesh}
              onSessionReady={(id) => void handleSessionReady(id)}
            />
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
