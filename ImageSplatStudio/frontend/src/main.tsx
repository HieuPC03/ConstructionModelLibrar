import { useCallback, useEffect, useRef, useState } from "react";
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
import { ClassificationPanel } from "./components/pceditor/ClassificationPanel";
import { CrossSectionPanel } from "./components/pceditor/CrossSectionPanel";
import { ViewpointPanel } from "./components/pceditor/ViewpointPanel";
import type { InspectedPoint } from "./components/pceditor/PointCloudInspector";
import { PointCloudProLayout } from "./components/pceditor/PointCloudProLayout";
import { PointCloudViewBar } from "./components/pceditor/PointCloudViewBar";
import type { CameraBridge } from "./components/pceditor/PointCloudViewBar";
import { PointCloudPanel } from "./components/PointCloudPanel";
import { PointCloudPreview, type PickMeta } from "./components/PointCloudPreview";
import { PointCloudPropertyTable } from "./components/PointCloudPropertyTable";
import { PointCloudStatusBar } from "./components/PointCloudStatusBar";
import { SplatViewer } from "./components/SplatViewer";
import { UploadPanel } from "./components/UploadPanel";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import {
  editorAddBreakline,
  editorAddCoordPoint,
  editorAddMeasurement,
  editorAddPoint,
  editorClipBox,
  editorDeletePoints,
  editorHideRegion,
  editorMeshAddVertex,
  editorMeshDeleteVertex,
  editorPolygonDelete,
  editorConfigureGrid,
  editorClassifyPolygon,
  editorCrossSection,
  editorDensityCheck,
  editorSaveViewpoint,
  editorLassoAction,
  editorRedo,
  editorUndo,
  fetchEditorProperties,
  type EditorProperties,
} from "./api/editor";
import {
  angleAtVertex,
  distance3d,
  polygonAreaXY,
  type ClipMode,
  type ContourData,
  type CrossSectionProfile,
  type EditorTool,
  type OsnapMode,
  type VolumeResult,
} from "./utils/editorTools";
import type { DeviationHeatmap } from "./api/editor";
import { logConsole } from "./utils/consoleLog";
import type { ColorMode } from "./utils/colorModes";
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
  const [gridCellSize, setGridCellSize] = useState(0.2);
  const [activeTool, setActiveTool] = useState<EditorTool>("navigate");
  const [osnapMode, setOsnapMode] = useState<OsnapMode>("point");
  const [clipMode, setClipMode] = useState<ClipMode>("inside");
  const [deleteRadius, setDeleteRadius] = useState(0.02);
  const [breaklineDraft, setBreaklineDraft] = useState<[number, number, number][]>([]);
  const [polygonDraft, setPolygonDraft] = useState<[number, number, number][]>([]);
  const [regionStart, setRegionStart] = useState<[number, number, number] | null>(null);
  const [measureStart, setMeasureStart] = useState<[number, number, number] | null>(null);
  const [meshReloadToken, setMeshReloadToken] = useState(0);
  const [snapCoords, setSnapCoords] = useState<[number, number, number] | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [inspectedPoint, setInspectedPoint] = useState<InspectedPoint | null>(null);
  const [activeClassId, setActiveClassId] = useState(2);
  const [lassoAction, setLassoAction] = useState<"classify" | "delete" | "hide">("classify");
  const [crossSectionStart, setCrossSectionStart] = useState<[number, number, number] | null>(null);
  const [crossSectionProfile, setCrossSectionProfile] = useState<CrossSectionProfile | null>(null);
  const [contourData, setContourData] = useState<ContourData | null>(null);
  const [volumeResult, setVolumeResult] = useState<VolumeResult | null>(null);
  const [anglePoints, setAnglePoints] = useState<[number, number, number][]>([]);
  const [densityCheckMode, setDensityCheckMode] = useState(false);
  const [deviationHeatmap, setDeviationHeatmap] = useState<DeviationHeatmap | null>(null);
  const cameraBridgeRef = useRef<CameraBridge | null>(null);

  const cancelActiveCommand = useCallback(() => {
    setActiveTool("navigate");
    setRegionStart(null);
    setMeasureStart(null);
    setCrossSectionStart(null);
    setBreaklineDraft([]);
    setPolygonDraft([]);
    setAnglePoints([]);
    setDensityCheckMode(false);
    setCrossSectionProfile(null);
    logConsole(tr("toolSelect"), "info");
  }, [tr]);

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
    if (pcPreviewFiles.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelActiveCommand();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pcPreviewFiles.length, cancelActiveCommand]);

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

  const handleImageSubmit = async (
    name: string,
    files: File[],
    demo: boolean,
    trainingQuality: "preview" | "standard",
  ) => {
    setBusy(true);
    setError(null);
    try {
      const result = await createJob(name, files, demo, trainingQuality);
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
    setActiveTool("navigate");
    setBreaklineDraft([]);
    setPolygonDraft([]);
    setRegionStart(null);
    setMeasureStart(null);
    setLastResult(null);
    setInspectedPoint(null);
    if (files.length > 0) setSelectedId(null);
  };

  const handleSessionReady = useCallback(async (sessionId: string) => {
    setPcSessionId(sessionId);
    try {
      const props = await fetchEditorProperties(sessionId);
      setEditorProperties(props);
      if (props.grid.cell_size) setGridCellSize(props.grid.cell_size);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, []);

  const bumpPreview = () => setPreviewRefresh((n) => n + 1);
  const bumpMesh = () => setMeshReloadToken((n) => n + 1);

  const handleEditorUpdated = (props: EditorProperties) => {
    setEditorProperties(props);
    if (props.grid.cell_size) setGridCellSize(props.grid.cell_size);
  };

  useEffect(() => {
    if (activeTool !== "clip_box" && activeTool !== "hide_region" && activeTool !== "grid_region")
      setRegionStart(null);
    if (activeTool !== "breakline") setBreaklineDraft([]);
    if (activeTool !== "polygon_delete" && activeTool !== "polygon_classify" && activeTool !== "measure_area")
      setPolygonDraft([]);
    if (activeTool !== "measure_distance" && activeTool !== "cross_section") setMeasureStart(null);
    if (activeTool !== "cross_section") setCrossSectionStart(null);
    if (activeTool !== "measure_angle") setAnglePoints([]);
  }, [activeTool]);

  const handleUndo = async () => {
    if (!pcSessionId) return;
    setError(null);
    try {
      const props = await editorUndo(pcSessionId);
      handleEditorUpdated(props);
      bumpPreview();
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleRedo = async () => {
    if (!pcSessionId) return;
    setError(null);
    try {
      const props = await editorRedo(pcSessionId);
      handleEditorUpdated(props);
      bumpPreview();
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleFinishBreakline = async () => {
    if (!pcSessionId || breaklineDraft.length < 2) return;
    setError(null);
    try {
      const props = await editorAddBreakline(pcSessionId, breaklineDraft);
      handleEditorUpdated(props);
      setBreaklineDraft([]);
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleFinishPolygon = async () => {
    if (!pcSessionId || polygonDraft.length < 3) return;
    setError(null);
    try {
      if (activeTool === "polygon_delete") {
        const props = await editorPolygonDelete(pcSessionId, polygonDraft);
        handleEditorUpdated(props);
        bumpPreview();
        setLastResult(`${tr("toolPolygonDeleted")}: ${props.removed_count ?? 0} ${tr("pcPreviewPoints")}`);
        setPolygonDraft([]);
        logConsole(`${tr("toolPolygonDeleted")}: ${props.removed_count ?? 0}`, "success");
      } else if (activeTool === "polygon_classify") {
        const props = await editorClassifyPolygon(pcSessionId, polygonDraft, activeClassId);
        handleEditorUpdated(props);
        bumpPreview();
        setLastResult(`${tr("toolPolygonClassified")}: ${props.classified_count ?? 0}`);
        setPolygonDraft([]);
        logConsole(`${tr("toolPolygonClassified")}: ${props.classified_count ?? 0}`, "success");
      } else if (activeTool === "measure_area") {
        const area = polygonAreaXY(polygonDraft);
        const props = await editorAddMeasurement(pcSessionId, "area", polygonDraft, area, "m²");
        handleEditorUpdated(props);
        setLastResult(`${tr("toolMeasureArea")}: ${area.toFixed(4)} m²`);
        setPolygonDraft([]);
      }
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handlePreviewPick = async (pos: [number, number, number], meta?: PickMeta) => {
    if (!pcSessionId) return;
    setError(null);
    try {
      switch (activeTool) {
        case "delete_point": {
          const props = await editorDeletePoints(pcSessionId, pos, deleteRadius);
          handleEditorUpdated(props);
          bumpPreview();
          setLastResult(`${tr("toolDeleted")}: ${props.removed_count ?? 0}`);
          break;
        }
        case "add_point": {
          const props = await editorAddPoint(pcSessionId, pos);
          handleEditorUpdated(props);
          bumpPreview();
          break;
        }
        case "coord_point": {
          const props = await editorAddCoordPoint(pcSessionId, pos);
          handleEditorUpdated(props);
          setLastResult(`${tr("toolCoordPoint")}: ${pos.map((v) => v.toFixed(3)).join(", ")}`);
          break;
        }
        case "clip_box":
        case "hide_region": {
          if (!regionStart) {
            setRegionStart(pos);
          } else {
            const min: [number, number, number] = [
              Math.min(regionStart[0], pos[0]),
              Math.min(regionStart[1], pos[1]),
              Math.min(regionStart[2], pos[2]),
            ];
            const max: [number, number, number] = [
              Math.max(regionStart[0], pos[0]),
              Math.max(regionStart[1], pos[1]),
              Math.max(regionStart[2], pos[2]),
            ];
            if (densityCheckMode) {
              const stats = await editorDensityCheck(pcSessionId, min, max, gridCellSize);
              setLastResult(
                `${tr("surveyDensity")}: ${stats.total_points.toLocaleString()} pts · ${stats.avg_density_pts_per_m2.toFixed(1)} pts/m²`,
              );
              logConsole(
                `${tr("surveyDensity")}: min=${stats.min_density} max=${stats.max_density} avg=${stats.avg_density_pts_per_m2.toFixed(1)} pts/m²`,
                "info",
              );
              setDensityCheckMode(false);
              setActiveTool("navigate");
            } else if (activeTool === "clip_box") {
              const props = await editorClipBox(pcSessionId, min, max, clipMode);
              handleEditorUpdated(props);
              bumpPreview();
              setLastResult(`${tr("toolClipBox")}: ${props.removed_count ?? 0} ${tr("pcPreviewPoints")}`);
            } else {
              const props = await editorHideRegion(pcSessionId, min, max);
              handleEditorUpdated(props);
              bumpPreview();
            }
            setRegionStart(null);
          }
          break;
        }
        case "polygon_delete":
        case "polygon_classify":
        case "measure_area":
          setPolygonDraft((d) => [...d, pos]);
          break;
        case "measure_distance": {
          if (!measureStart) {
            setMeasureStart(pos);
          } else {
            const dist = distance3d(measureStart, pos);
            const props = await editorAddMeasurement(pcSessionId, "distance", [measureStart, pos], dist);
            handleEditorUpdated(props);
            setLastResult(`${tr("toolMeasureDistance")}: ${dist.toFixed(4)} m`);
            setMeasureStart(null);
          }
          break;
        }
        case "measure_angle": {
          const next = [...anglePoints, pos];
          if (next.length < 3) {
            setAnglePoints(next);
          } else {
            const deg = angleAtVertex(next[0], next[1], next[2]);
            const props = await editorAddMeasurement(
              pcSessionId,
              "angle",
              [next[0], next[1], next[2]],
              deg,
              "°",
            );
            handleEditorUpdated(props);
            setLastResult(`${tr("toolMeasureAngle")}: ${deg.toFixed(2)}°`);
            setAnglePoints([]);
          }
          break;
        }
        case "cross_section": {
          if (!crossSectionStart) {
            setCrossSectionStart(pos);
          } else {
            const profile = await editorCrossSection(pcSessionId, crossSectionStart, pos);
            setCrossSectionProfile(profile);
            const props = await editorAddMeasurement(
              pcSessionId,
              "cross_section",
              [crossSectionStart, pos],
              profile.length_m,
              "m",
            );
            handleEditorUpdated(props);
            setLastResult(`${tr("toolCrossSection")}: L=${profile.length_m.toFixed(2)} m`);
            setCrossSectionStart(null);
          }
          break;
        }
        case "mesh_add": {
          const props = await editorMeshAddVertex(pcSessionId, pos);
          handleEditorUpdated(props);
          bumpMesh();
          break;
        }
        case "mesh_delete": {
          if (meta?.vertexIndex != null && meta.vertexIndex >= 0) {
            const props = await editorMeshDeleteVertex(pcSessionId, meta.vertexIndex);
            handleEditorUpdated(props);
            bumpMesh();
          }
          break;
        }
        case "breakline":
          setBreaklineDraft((d) => [...d, pos]);
          break;
        case "grid_region": {
          if (!regionStart) {
            setRegionStart(pos);
          } else {
            const min: [number, number, number] = [
              Math.min(regionStart[0], pos[0]),
              Math.min(regionStart[1], pos[1]),
              Math.min(regionStart[2], pos[2]),
            ];
            const max: [number, number, number] = [
              Math.max(regionStart[0], pos[0]),
              Math.max(regionStart[1], pos[1]),
              Math.max(regionStart[2], pos[2]),
            ];
            const props = await editorConfigureGrid(pcSessionId, {
              enabled: !!editorProperties?.grid.enabled,
              cell_size: gridCellSize,
              region_min: min,
              region_max: max,
            });
            handleEditorUpdated(props);
            bumpPreview();
            setRegionStart(null);
            setActiveTool("navigate");
            setLastResult(tr("gridRegionSet"));
          }
          break;
        }
        default:
          break;
      }
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveTool("navigate");
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && pcSessionId) {
        e.preventDefault();
        void handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey)) && pcSessionId) {
        e.preventDefault();
        void handleRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleInspect = (pos: [number, number, number], meta?: PickMeta) => {
    setInspectedPoint({
      viewer: pos,
      index: meta?.pointIndex,
      rgb: meta?.rgb,
    });
  };

  const handleLassoComplete = async (
    polygonNdc: [number, number][],
    matrices: { view_matrix: number[]; proj_matrix: number[] },
  ) => {
    if (!pcSessionId) return;
    setError(null);
    try {
      const props = await editorLassoAction(pcSessionId, {
        polygon_ndc: polygonNdc,
        view_matrix: matrices.view_matrix,
        proj_matrix: matrices.proj_matrix,
        action: lassoAction,
        class_id: activeClassId,
      });
      handleEditorUpdated(props);
      let msg = tr("toolLassoSelect");
      if (lassoAction === "delete") {
        bumpPreview();
        msg = `${tr("toolLassoDelete")}: ${props.removed_count ?? 0}`;
      } else if (lassoAction === "classify") {
        bumpPreview();
        msg = `${tr("toolLassoClassify")}: ${props.classified_count ?? 0}`;
      } else {
        bumpPreview();
        msg = `${tr("toolLassoHide")}: ${props.selected_count ?? 0}`;
      }
      setLastResult(msg);
      logConsole(msg, "success");
      setActiveTool("navigate");
    } catch (e: unknown) {
      setError(String(e));
      logConsole(String(e), "error");
    }
  };

  const colorMode = (editorProperties?.view?.color_mode as ColorMode) ?? "rgb";

  const showPointCloudPreview =
    mode === "pointcloud" &&
    pcPreviewFiles.length > 0 &&
    !selectedJob;

  return (
    <div className={`app-shell ${showPointCloudPreview ? "tp-editor" : ""}`}>
      <header className={`app-header ${showPointCloudPreview ? "app-header-compact" : ""}`}>
        <div className="brand">
          <Logo size={showPointCloudPreview ? 28 : 40} />
          <div>
            {!showPointCloudPreview && <p className="eyebrow">{tr("appTagline")}</p>}
            <h1 className={showPointCloudPreview ? "app-title-compact" : ""}>{tr("appTitle")}</h1>
          </div>
        </div>
        <div className="header-actions">
          <LanguageSwitcher />
          {!showPointCloudPreview && (
            <div className="status-pills">
              <span className={`pill ${health?.open3d_available ? "pill-ok" : "pill-warn"}`}>
                {tr("statusOpen3d")} {health?.open3d_available ? tr("statusOk") : tr("statusNa")}
              </span>
              <span className={`pill ${health?.gpu_available ? "pill-ok" : "pill-warn"}`}>
                {tr("statusGpu")} {health?.gpu_available ? tr("statusOk") : tr("statusNa")}
              </span>
            </div>
          )}
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

      <main className={`layout ${showPointCloudPreview ? "layout-pro-editor" : ""}`}>
        {showPointCloudPreview ? (
          <PointCloudProLayout
            sessionId={pcSessionId}
            properties={editorProperties}
            activeTool={activeTool}
            osnapMode={osnapMode}
            clipMode={clipMode}
            deleteRadius={deleteRadius}
            breaklineCount={breaklineDraft.length}
            polygonCount={polygonDraft.length}
            inspectedPoint={inspectedPoint}
            gridCellSize={gridCellSize}
            onGridCellSizeChange={setGridCellSize}
            onUpdated={handleEditorUpdated}
            onRefreshPreview={bumpPreview}
            onError={setError}
            onToolChange={setActiveTool}
            onCancelCommand={cancelActiveCommand}
            onOsnapModeChange={setOsnapMode}
            onClipModeChange={setClipMode}
            onDeleteRadiusChange={setDeleteRadius}
            onFinishBreakline={() => void handleFinishBreakline()}
            onFinishPolygon={() => void handleFinishPolygon()}
            onUndo={() => void handleUndo()}
            onRedo={() => void handleRedo()}
            onStartGridRegion={() => {
              setActiveTool("grid_region");
              setRegionStart(null);
            }}
            onCreateGrid={async () => {
              if (!pcSessionId) return;
              const props = await editorConfigureGrid(pcSessionId, {
                enabled: true,
                cell_size: gridCellSize,
                create_data: true,
              });
              handleEditorUpdated(props);
              bumpPreview();
              logConsole(tr("gridCreate"), "success");
            }}
            onContoursReady={(data) => {
              setContourData(data);
              bumpPreview();
              setLastResult(`${tr("surveyContours")}: ${data.segment_count} segments`);
            }}
            onVolumeResult={(result) => {
              setVolumeResult(result);
              setLastResult(
                `${tr("surveyVolume")}: ${tr("surveyCut")}=${result.cut_m3.toFixed(1)} · ${tr("surveyFill")}=${result.fill_m3.toFixed(1)} · Δ=${result.net_m3.toFixed(1)} m³`,
              );
            }}
            onDeviationReady={(data) => {
              setDeviationHeatmap(data);
              setLastResult(
                `${tr("dekiEvaluate")}: RMSE=${data.stats.rmse_m.toFixed(3)}m · ${tr("dekiWithinOk")}=${data.stats.within_ok_pct.toFixed(1)}%`,
              );
            }}
            onStartDensityRegion={() => {
              setDensityCheckMode(true);
              setActiveTool("hide_region");
              setRegionStart(null);
              logConsole(tr("surveyDensityHint"), "info");
            }}
            viewport={
              <>
              <PointCloudViewBar cameraBridgeRef={cameraBridgeRef} />
              <PointCloudPreview
                files={pcPreviewFiles}
                refreshToken={previewRefresh}
                gridEnabled={!!editorProperties?.grid.enabled}
                showMesh={!!editorProperties?.mesh}
                meshReloadToken={meshReloadToken}
                showAxes={editorProperties?.view?.show_axes ?? true}
                crsEpsg={editorProperties?.crs?.epsg ?? 6668}
                normMeta={editorProperties?.norm_meta}
                swapXy={!!editorProperties?.swap_xy}
                activeTool={activeTool}
                osnapMode={osnapMode}
                colorMode={colorMode}
                showGridSurface={!!editorProperties?.view?.show_grid_surface}
                breaklines={editorProperties?.breaklines ?? []}
                breaklineDraft={breaklineDraft}
                polygonDraft={polygonDraft}
                coordPoints={editorProperties?.coord_points ?? []}
                measurements={editorProperties?.measurements ?? []}
                measureStart={measureStart}
                regionStart={regionStart}
                crossSectionLine={
                  crossSectionProfile
                    ? [crossSectionProfile.start as [number, number, number], crossSectionProfile.end as [number, number, number]]
                    : editorProperties?.last_cross_section
                      ? [
                          editorProperties.last_cross_section.start as [number, number, number],
                          editorProperties.last_cross_section.end as [number, number, number],
                        ]
                      : null
                }
                crossSectionDraft={crossSectionStart}
                contourSegments={contourData?.segments ?? null}
                angleDraft={anglePoints}
                deviationHeatmap={deviationHeatmap}
                cameraBridgeRef={cameraBridgeRef}
                onSessionReady={handleSessionReady}
                onPick={(pos, meta) => void handlePreviewPick(pos, meta)}
                onInspect={handleInspect}
                onLassoComplete={(polygon, matrices) => void handleLassoComplete(polygon, matrices)}
                onSnapHover={setSnapCoords}
              />
              <CrossSectionPanel
                profile={crossSectionProfile}
                onClose={() => setCrossSectionProfile(null)}
              />
              {volumeResult && (
                <div className="pc-volume-result">
                  <strong>{tr("surveyVolume")}</strong>
                  <span>{tr("surveyCut")}: {volumeResult.cut_m3.toFixed(2)} m³</span>
                  <span>{tr("surveyFill")}: {volumeResult.fill_m3.toFixed(2)} m³</span>
                  <span>Δ: {volumeResult.net_m3.toFixed(2)} m³</span>
                  <button type="button" onClick={() => setVolumeResult(null)}>×</button>
                </div>
              )}
              </>
            }
            propertyPanel={
              <>
                <ViewpointPanel
                  sessionId={pcSessionId}
                  properties={editorProperties}
                  onSaveView={() => {
                    if (!pcSessionId || !cameraBridgeRef.current) return;
                    const cam = cameraBridgeRef.current.getCamera();
                    if (!cam) return;
                    void editorSaveViewpoint(pcSessionId, `View ${(editorProperties?.viewpoints?.length ?? 0) + 1}`, cam.position, cam.target).then(
                      handleEditorUpdated,
                    );
                  }}
                  onApplyView={(camera, target) => {
                    cameraBridgeRef.current?.setCamera(
                      camera as [number, number, number],
                      target as [number, number, number],
                    );
                  }}
                  onUpdated={handleEditorUpdated}
                />
                <ClassificationPanel
                  sessionId={pcSessionId}
                  properties={editorProperties}
                  activeClassId={activeClassId}
                  onActiveClassChange={setActiveClassId}
                  activeTool={activeTool}
                  lassoAction={lassoAction}
                  onLassoActionChange={setLassoAction}
                  onUpdated={handleEditorUpdated}
                  onRefreshPreview={bumpPreview}
                  onError={setError}
                />
                <PointCloudPanel
                  onSubmit={handlePointCloudSubmit}
                  onFilesChange={handlePointCloudFilesChange}
                  busy={busy}
                  open3dAvailable={!!health?.open3d_available}
                />
                <PointCloudPropertyTable
                  sessionId={pcSessionId}
                  properties={editorProperties}
                  gridCellSize={gridCellSize}
                  onGridCellSizeChange={setGridCellSize}
                  onUpdated={handleEditorUpdated}
                  onRefreshPreview={bumpPreview}
                  onError={setError}
                  onStartGridRegion={() => {
                    setActiveTool("grid_region");
                    setRegionStart(null);
                  }}
                  onCreateGrid={async () => {
                    if (!pcSessionId) return;
                    const props = await editorConfigureGrid(pcSessionId, {
                      enabled: true,
                      cell_size: gridCellSize,
                      create_data: true,
                    });
                    handleEditorUpdated(props);
                    bumpPreview();
                    logConsole(tr("gridCreate"), "success");
                  }}
                />
                <JobList
                  jobs={jobs}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setPcPreviewFiles([]);
                  }}
                  onDelete={handleDelete}
                />
              </>
            }
            statusBar={
              <PointCloudStatusBar
                activeTool={activeTool}
                snapCoords={snapCoords}
                totalPoints={editorProperties?.total_points ?? null}
                lastResult={lastResult}
                crsName={editorProperties?.crs?.name}
              />
            }
          />
        ) : (
          <>
            <aside className="sidebar">
              {mode === "pointcloud" ? (
                <PointCloudPanel
                  onSubmit={handlePointCloudSubmit}
                  onFilesChange={handlePointCloudFilesChange}
                  busy={busy}
                  open3dAvailable={!!health?.open3d_available}
                />
              ) : (
                <UploadPanel
                  onSubmit={handleImageSubmit}
                  busy={busy}
                  demoMode={!!health?.demo_mode}
                  inriaAvailable={!!health?.inria_3dgs_available}
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
          </>
        )}
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
