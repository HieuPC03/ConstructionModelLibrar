import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { useI18n } from "../i18n/I18nProvider";
import { decodeGridLines, editorGridUrl, editorMeshUrl } from "../api/editor";
import {
  fetchPreviewGeometry,
  previewPointClouds,
  type PointCloudPreviewGeometry,
  type PointCloudPreviewMeta,
} from "../api";
import { formatFileSize } from "../utils/pointcloud";
import { OSNAP_CURSOR, TOOL_CURSORS, type EditorTool } from "../utils/editorTools";
import {
  formatSnapLabel,
  ndcFromEvent,
  snapToMesh,
  snapToPointCloud,
} from "../utils/pointcloudInteraction";

const DEFAULT_PERCENT = 20;
const MIN_POINT_SIZE_M = 0.0001;
const MAX_POINT_SIZE_M = 0.01;
const DEFAULT_POINT_SIZE_M = 0.002;

function formatPointSize(m: number, dotLabel: string): string {
  if (m <= MIN_POINT_SIZE_M * 1.5) return dotLabel;
  if (m < 0.001) return `${(m * 1000).toFixed(1)} mm`;
  return `${m.toFixed(3)} m`;
}

type PreviewData = PointCloudPreviewMeta & PointCloudPreviewGeometry;

export interface PickMeta {
  vertexIndex?: number;
}

interface PointCloudPreviewProps {
  files: File[];
  refreshToken?: number;
  gridEnabled?: boolean;
  showMesh?: boolean;
  meshReloadToken?: number;
  activeTool?: EditorTool;
  osnapEnabled?: boolean;
  breaklines?: { id: string; points: number[][] }[];
  breaklineDraft?: [number, number, number][];
  regionStart?: [number, number, number] | null;
  onSessionReady?: (sessionId: string) => void;
  onPick?: (position: [number, number, number], meta?: PickMeta) => void;
  onSnapHover?: (position: [number, number, number] | null) => void;
}

function toolHintKey(tool: EditorTool): "toolHint_navigate" | "toolHint_delete_point" | "toolHint_add_point" | "toolHint_select_region" | "toolHint_mesh_add" | "toolHint_mesh_delete" | "toolHint_breakline" {
  const map: Record<EditorTool, ReturnType<typeof toolHintKey>> = {
    navigate: "toolHint_navigate",
    delete_point: "toolHint_delete_point",
    add_point: "toolHint_add_point",
    select_region: "toolHint_select_region",
    mesh_add: "toolHint_mesh_add",
    mesh_delete: "toolHint_mesh_delete",
    breakline: "toolHint_breakline",
  };
  return map[tool];
}

function buildBreaklineGeometry(lines: number[][][]): THREE.BufferGeometry | null {
  let segCount = 0;
  for (const pts of lines) {
    if (pts.length >= 2) segCount += pts.length - 1;
  }
  if (segCount === 0) return null;

  const positions = new Float32Array(segCount * 6);
  let offset = 0;
  for (const pts of lines) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      positions[offset++] = a[0];
      positions[offset++] = a[1];
      positions[offset++] = a[2];
      positions[offset++] = b[0];
      positions[offset++] = b[1];
      positions[offset++] = b[2];
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geom;
}

export function PointCloudPreview({
  files,
  refreshToken = 0,
  gridEnabled = false,
  showMesh = false,
  meshReloadToken = 0,
  activeTool = "navigate",
  osnapEnabled = true,
  breaklines = [],
  breaklineDraft = [],
  regionStart = null,
  onSessionReady,
  onPick,
  onSnapHover,
}: PointCloudPreviewProps) {
  const { tr } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const sessionRef = useRef<string | null>(null);
  const sceneCtxRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    points: THREE.Points;
    meshRoot: THREE.Group;
    breaklineGroup: THREE.Group;
    snapMarker: THREE.Mesh;
    regionGroup: THREE.Group;
    maxDim: number;
    raycaster: THREE.Raycaster;
    pickPlane: THREE.Plane;
  } | null>(null);

  const toolRef = useRef(activeTool);
  const osnapRef = useRef(osnapEnabled);
  const onPickRef = useRef(onPick);
  const onSnapHoverRef = useRef(onSnapHover);

  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [samplePercent, setSamplePercent] = useState(DEFAULT_PERCENT);
  const [debouncedPercent, setDebouncedPercent] = useState(DEFAULT_PERCENT);
  const [pointSizeM, setPointSizeM] = useState(DEFAULT_POINT_SIZE_M);
  const [snapLabel, setSnapLabel] = useState<string | null>(null);

  useEffect(() => {
    toolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    osnapRef.current = osnapEnabled;
  }, [osnapEnabled]);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    onSnapHoverRef.current = onSnapHover;
  }, [onSnapHover]);

  useEffect(() => {
    sessionRef.current = null;
    setSamplePercent(DEFAULT_PERCENT);
    setDebouncedPercent(DEFAULT_PERCENT);
    setPointSizeM(DEFAULT_POINT_SIZE_M);
  }, [files]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPercent(samplePercent), 350);
    return () => window.clearTimeout(timer);
  }, [samplePercent]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (sessionRef.current) {
          const geometry = await fetchPreviewGeometry(sessionRef.current, debouncedPercent);
          if (cancelled) return;
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...geometry,
              preview_count: geometry.count,
              preview_percent: debouncedPercent,
              preview_fraction: geometry.count / prev.total_points,
            };
          });
          return;
        }

        const result = await previewPointClouds(files, debouncedPercent);
        if (cancelled) return;
        if (result.preview_session_id) {
          sessionRef.current = result.preview_session_id;
          onSessionReady?.(result.preview_session_id);
        }
        setData(result);
      } catch (e: unknown) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [files, debouncedPercent, refreshToken, onSessionReady]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.size = pointSizeM;
      materialRef.current.needsUpdate = true;
    }
  }, [pointSizeM]);

  const resolvePick = useCallback(
    (
      raycaster: THREE.Raycaster,
      ctx: NonNullable<typeof sceneCtxRef.current>,
    ): { point: THREE.Vector3; vertexIndex?: number } | null => {
      const tool = toolRef.current;
      const osnap = osnapRef.current;
      const threshold = ctx.maxDim * (osnap ? 0.012 : 0.06);
      const meshObj = ctx.meshRoot.children[0] ?? null;

      if (tool === "mesh_add" || tool === "mesh_delete" || tool === "breakline") {
        if (meshObj) {
          const snap = snapToMesh(raycaster, meshObj, ctx.maxDim * 0.025);
          if (snap) return { point: snap.point, vertexIndex: snap.vertexIndex };
        }
      }

      const ptSnap = snapToPointCloud(raycaster, ctx.points, threshold);
      if (ptSnap) return { point: ptSnap };

      if (!osnap && (tool === "add_point" || tool === "breakline")) {
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(ctx.pickPlane, hit)) {
          return { point: hit };
        }
      }

      return null;
    },
    [],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !data?.count) return;

    let cancelled = false;
    materialRef.current = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080c);

    const count = data.count;
    const positions = data.positions;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      if (data.colors) {
        colors[i * 3] = data.colors[i * 3] / 255;
        colors[i * 3 + 1] = data.colors[i * 3 + 1] / 255;
        colors[i * 3 + 2] = data.colors[i * 3 + 2] / 255;
      } else {
        const t = i / Math.max(count - 1, 1);
        colors[i * 3] = 0.45 + t * 0.3;
        colors[i * 3 + 1] = 0.55 + t * 0.2;
        colors[i * 3 + 2] = 0.95;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions.slice(0, count * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const center = box.getCenter(new THREE.Vector3());

    const material = new THREE.PointsMaterial({
      size: pointSizeM,
      vertexColors: true,
      sizeAttenuation: true,
    });
    materialRef.current = material;
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const camera = new THREE.PerspectiveCamera(50, 1, maxDim * 0.001, maxDim * 100);
    camera.position.set(maxDim * 1.4, maxDim * 1.0, maxDim * 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(center);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const floor = new THREE.GridHelper(maxDim * 2.5, 20, 0x2a3444, 0x1a2230);
    scene.add(floor);

    const meshRoot = new THREE.Group();
    scene.add(meshRoot);

    const breaklineGroup = new THREE.Group();
    scene.add(breaklineGroup);

    const regionGroup = new THREE.Group();
    scene.add(regionGroup);

    const snapMarker = new THREE.Mesh(
      new THREE.SphereGeometry(maxDim * 0.008, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 }),
    );
    snapMarker.visible = false;
    scene.add(snapMarker);

    const raycaster = new THREE.Raycaster();
    const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y);

    sceneCtxRef.current = {
      scene,
      camera,
      renderer,
      controls,
      points,
      meshRoot,
      breaklineGroup,
      snapMarker,
      regionGroup,
      maxDim,
      raycaster,
      pickPlane,
    };

    const sid = sessionRef.current;
    if (gridEnabled && sid) {
      fetch(editorGridUrl(sid))
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((buf) => {
          if (!buf || cancelled) return;
          const lines = decodeGridLines(buf);
          const segCount = lines.length / 6;
          const segPositions = new Float32Array(segCount * 6);
          for (let i = 0; i < segCount; i++) {
            segPositions[i * 6] = lines[i * 6];
            segPositions[i * 6 + 1] = lines[i * 6 + 1];
            segPositions[i * 6 + 2] = lines[i * 6 + 2];
            segPositions[i * 6 + 3] = lines[i * 6 + 3];
            segPositions[i * 6 + 4] = lines[i * 6 + 4];
            segPositions[i * 6 + 5] = lines[i * 6 + 5];
          }
          const gridGeom = new THREE.BufferGeometry();
          gridGeom.setAttribute("position", new THREE.BufferAttribute(segPositions, 3));
          const gridMat = new THREE.LineBasicMaterial({ color: 0x44ddaa, transparent: true, opacity: 0.35 });
          scene.add(new THREE.LineSegments(gridGeom, gridMat));
        })
        .catch(() => undefined);
    }

    const loadMesh = () => {
      if (!showMesh || !sid) return;
      while (meshRoot.children.length) {
        const child = meshRoot.children[0];
        meshRoot.remove(child);
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material?.dispose();
          }
        });
      }
      const loader = new OBJLoader();
      loader.load(
        `${editorMeshUrl(sid)}?t=${Date.now()}`,
        (obj) => {
          if (cancelled) return;
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x88aaff,
                transparent: true,
                opacity: 0.45,
                wireframe: false,
              });
            }
          });
          meshRoot.add(obj);
        },
        undefined,
        () => undefined,
      );
    };
    loadMesh();

    const onMove = (event: MouseEvent) => {
      const ctx = sceneCtxRef.current;
      if (!ctx || toolRef.current === "navigate") {
        ctx?.snapMarker && (ctx.snapMarker.visible = false);
        setSnapLabel(null);
        onSnapHoverRef.current?.(null);
        return;
      }
      const ndc = ndcFromEvent(event, ctx.renderer.domElement);
      ctx.raycaster.setFromCamera(ndc, ctx.camera);
      const hit = resolvePick(ctx.raycaster, ctx);
      if (hit) {
        ctx.snapMarker.position.copy(hit.point);
        ctx.snapMarker.visible = true;
        const pos: [number, number, number] = [hit.point.x, hit.point.y, hit.point.z];
        setSnapLabel(formatSnapLabel(hit.point));
        onSnapHoverRef.current?.(pos);
      } else {
        ctx.snapMarker.visible = false;
        setSnapLabel(null);
        onSnapHoverRef.current?.(null);
      }
    };

    const onClick = (event: MouseEvent) => {
      const ctx = sceneCtxRef.current;
      const tool = toolRef.current;
      if (!ctx || tool === "navigate") return;
      event.preventDefault();
      const ndc = ndcFromEvent(event, ctx.renderer.domElement);
      ctx.raycaster.setFromCamera(ndc, ctx.camera);
      const hit = resolvePick(ctx.raycaster, ctx);
      if (!hit) return;
      const pos: [number, number, number] = [hit.point.x, hit.point.y, hit.point.z];
      onPickRef.current?.(pos, { vertexIndex: hit.vertexIndex });
    };

    renderer.domElement.addEventListener("mousemove", onMove);
    renderer.domElement.addEventListener("click", onClick);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let frame = 0;
    const tick = () => {
      if (cancelled) return;
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener("mousemove", onMove);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      materialRef.current = null;
      snapMarker.geometry.dispose();
      (snapMarker.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneCtxRef.current = null;
    };
  }, [data, pointSizeM, gridEnabled, showMesh, resolvePick]);

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;
    ctx.controls.enabled = activeTool === "navigate";
  }, [activeTool]);

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx || !showMesh) return;
    const sid = sessionRef.current;
    if (!sid) return;

    while (ctx.meshRoot.children.length) {
      const child = ctx.meshRoot.children[0];
      ctx.meshRoot.remove(child);
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
    }

    const loader = new OBJLoader();
    loader.load(
      `${editorMeshUrl(sid)}?t=${Date.now()}`,
      (obj) => {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x88aaff,
              transparent: true,
              opacity: 0.45,
              wireframe: false,
            });
          }
        });
        ctx.meshRoot.add(obj);
      },
      undefined,
      () => undefined,
    );
  }, [meshReloadToken, showMesh]);

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;

    while (ctx.breaklineGroup.children.length) {
      const child = ctx.breaklineGroup.children[0];
      ctx.breaklineGroup.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    const allLines: number[][][] = [
      ...breaklines.map((bl) => bl.points),
      ...(breaklineDraft.length >= 2 ? [breaklineDraft] : []),
    ];
    const geom = buildBreaklineGeometry(allLines);
    if (geom) {
      const mat = new THREE.LineBasicMaterial({ color: 0xff6644, linewidth: 2 });
      ctx.breaklineGroup.add(new THREE.LineSegments(geom, mat));
    }
    if (breaklineDraft.length >= 1) {
      const draftGeom = new THREE.BufferGeometry();
      const draftPos = new Float32Array(breaklineDraft.length * 3);
      breaklineDraft.forEach((p, i) => {
        draftPos[i * 3] = p[0];
        draftPos[i * 3 + 1] = p[1];
        draftPos[i * 3 + 2] = p[2];
      });
      draftGeom.setAttribute("position", new THREE.BufferAttribute(draftPos, 3));
      const draftMat = new THREE.PointsMaterial({ color: 0xffaa00, size: ctx.maxDim * 0.012 });
      ctx.breaklineGroup.add(new THREE.Points(draftGeom, draftMat));
    }
  }, [breaklines, breaklineDraft]);

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;

    while (ctx.regionGroup.children.length) {
      const child = ctx.regionGroup.children[0];
      ctx.regionGroup.remove(child);
      if (child instanceof THREE.LineSegments || child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    if (!regionStart) return;

    const s = new THREE.Vector3(...regionStart);
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(ctx.maxDim * 0.015, ctx.maxDim * 0.015, ctx.maxDim * 0.015),
      new THREE.MeshBasicMaterial({ color: 0x44aaff, wireframe: true }),
    );
    marker.position.copy(s);
    ctx.regionGroup.add(marker);
  }, [regionStart]);

  const cursorClass =
    activeTool === "navigate"
      ? "pc-cursor-navigate"
      : osnapEnabled
        ? "pc-cursor-osnap"
        : `pc-cursor-${activeTool}`;

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const displayPercent = data?.preview_percent ?? samplePercent;

  return (
    <div className="pc-preview">
      <div className="pc-preview-toolbar">
        <p className="pc-preview-meta muted">
          {files.length} {tr("pcFilesSelected")} · {formatFileSize(totalSize)}
          {data && (
            <>
              {" "}
              · {data.total_points.toLocaleString()} {tr("pcPreviewPoints")}
              {" "}
              · {tr("pcPreviewShowing")} {data.preview_count.toLocaleString()} ({displayPercent}%)
            </>
          )}
          {snapLabel && activeTool !== "navigate" && (
            <>
              {" "}
              · {tr("toolSnap")}: <strong>{snapLabel}</strong>
            </>
          )}
        </p>
        <div className="pc-preview-sliders">
          <div className="pc-slider-group">
            <label className="pc-sample-label" htmlFor="pc-sample-percent">
              {tr("pcPreviewDensity")} <strong>{samplePercent}%</strong>
            </label>
            <input
              id="pc-sample-percent"
              className="pc-sample-slider"
              type="range"
              min={1}
              max={100}
              step={1}
              value={samplePercent}
              disabled={loading && !data}
              onChange={(e) => setSamplePercent(Number(e.target.value))}
            />
          </div>
          <div className="pc-slider-group">
            <label className="pc-sample-label" htmlFor="pc-point-size">
              {tr("pcPreviewPointSize")}{" "}
              <strong>{formatPointSize(pointSizeM, tr("pcPreviewPointMin"))}</strong>
            </label>
            <input
              id="pc-point-size"
              className="pc-sample-slider"
              type="range"
              min={MIN_POINT_SIZE_M}
              max={MAX_POINT_SIZE_M}
              step={0.0001}
              value={pointSizeM}
              disabled={!data}
              onChange={(e) => setPointSizeM(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`pc-preview-viewport ${cursorClass}`}
        style={{
          cursor:
            activeTool === "navigate"
              ? TOOL_CURSORS.navigate
              : osnapEnabled
                ? OSNAP_CURSOR
                : TOOL_CURSORS[activeTool],
        }}
      >
        {loading && (
          <div className="viewer-placeholder">
            <div className="spinner" />
            <p>{tr("pcPreviewLoading")}</p>
          </div>
        )}
        {error && !loading && (
          <div className="viewer-placeholder">
            <p className="error-text">{error}</p>
          </div>
        )}
        {activeTool !== "navigate" && (
          <div className="pc-tool-hint">
            {tr(toolHintKey(activeTool))}
            {activeTool === "select_region" && regionStart && ` · ${tr("toolRegionSecond")}`}
          </div>
        )}
        <div ref={mountRef} className="pc-preview-mount" />
      </div>
    </div>
  );
}
