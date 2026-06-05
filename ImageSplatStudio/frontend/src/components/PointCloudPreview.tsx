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
import { viewerToWorld, formatWorldCoords, type NormMeta } from "../utils/coordTransform";
import { buildGeoreferencedBasemap, effectiveBasemapMode, type BasemapMode } from "../utils/basemapTiles";
import { applyViewDirection, createAxesHelper, ViewCube, type ViewDirection } from "./ViewCube";
import { OSNAP_CURSOR, TOOL_CURSORS, toolHintKey, type EditorTool, type OsnapMode } from "../utils/editorTools";
import { applyColorMode, type ColorMode } from "../utils/colorModes";
import { fetchGridSurface } from "../api/editor";
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
  pointIndex?: number;
  rgb?: [number, number, number];
}

interface PointCloudPreviewProps {
  files: File[];
  refreshToken?: number;
  gridEnabled?: boolean;
  showMesh?: boolean;
  meshReloadToken?: number;
  showAxes?: boolean;
  basemapEnabled?: boolean;
  basemapMode?: BasemapMode;
  crsEpsg?: number;
  normMeta?: NormMeta;
  swapXy?: boolean;
  activeTool?: EditorTool;
  osnapMode?: OsnapMode;
  breaklines?: { id: string; points: number[][] }[];
  breaklineDraft?: [number, number, number][];
  polygonDraft?: [number, number, number][];
  coordPoints?: { id: string; position: number[]; label: string }[];
  measurements?: { id: string; type: string; points: number[][]; value: number; unit: string }[];
  measureStart?: [number, number, number] | null;
  regionStart?: [number, number, number] | null;
  colorMode?: ColorMode;
  showGridSurface?: boolean;
  onSessionReady?: (sessionId: string) => void;
  onPick?: (position: [number, number, number], meta?: PickMeta) => void;
  onInspect?: (position: [number, number, number], meta?: PickMeta) => void;
  onSnapHover?: (position: [number, number, number] | null) => void;
}

function buildLineGeometry(segments: [number[], number[]][]): THREE.BufferGeometry | null {
  if (segments.length === 0) return null;
  const positions = new Float32Array(segments.length * 6);
  segments.forEach(([a, b], i) => {
    positions[i * 6] = a[0];
    positions[i * 6 + 1] = a[1];
    positions[i * 6 + 2] = a[2];
    positions[i * 6 + 3] = b[0];
    positions[i * 6 + 4] = b[1];
    positions[i * 6 + 5] = b[2];
  });
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geom;
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
  showAxes = true,
  basemapEnabled = false,
  basemapMode = "aerial",
  crsEpsg = 6668,
  normMeta,
  swapXy = false,
  activeTool = "navigate",
  osnapMode = "point",
  breaklines = [],
  breaklineDraft = [],
  polygonDraft = [],
  coordPoints = [],
  measurements = [],
  measureStart = null,
  regionStart = null,
  colorMode = "rgb",
  showGridSurface = false,
  onSessionReady,
  onPick,
  onInspect,
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
    annotationGroup: THREE.Group;
    gridSurfaceGroup: THREE.Group;
    axesGroup: THREE.Group;
    basemapPlane: THREE.Mesh | null;
    maxDim: number;
    raycaster: THREE.Raycaster;
    pickPlane: THREE.Plane;
  } | null>(null);

  const toolRef = useRef(activeTool);
  const osnapRef = useRef(osnapMode);
  const onPickRef = useRef(onPick);
  const onInspectRef = useRef(onInspect);
  const onSnapHoverRef = useRef(onSnapHover);
  const onSessionReadyRef = useRef(onSessionReady);
  const cameraSavedRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const filesKeyRef = useRef<string>("");

  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [samplePercent, setSamplePercent] = useState(DEFAULT_PERCENT);
  const [debouncedPercent, setDebouncedPercent] = useState(DEFAULT_PERCENT);
  const [pointSizeM, setPointSizeM] = useState(DEFAULT_POINT_SIZE_M);
  const [snapLabel, setSnapLabel] = useState<string | null>(null);
  const colorModeRef = useRef(colorMode);
  const rawColorsRef = useRef<Uint8Array | null>(null);
  const positionsRef = useRef<Float32Array | null>(null);
  const viewCubeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    colorModeRef.current = colorMode;
  }, [colorMode]);

  useEffect(() => {
    toolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    osnapRef.current = osnapMode;
  }, [osnapMode]);
  useEffect(() => {
    onSessionReadyRef.current = onSessionReady;
  }, [onSessionReady]);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    onInspectRef.current = onInspect;
  }, [onInspect]);
  useEffect(() => {
    onSnapHoverRef.current = onSnapHover;
  }, [onSnapHover]);

  useEffect(() => {
    const key = files.map((f) => `${f.name}:${f.size}`).join("|");
    if (key !== filesKeyRef.current) {
      filesKeyRef.current = key;
      cameraSavedRef.current = null;
    }
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
    const isRefresh = !!sessionRef.current;
    if (!isRefresh) {
      setLoading(true);
    }
    setError(null);

    const load = async () => {
      try {
        if (sessionRef.current) {
          const ctx = sceneCtxRef.current;
          if (ctx) {
            cameraSavedRef.current = {
              pos: ctx.camera.position.clone(),
              target: ctx.controls.target.clone(),
            };
          }
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
              total_points: prev.total_points,
            };
          });
          return;
        }

        const result = await previewPointClouds(files, debouncedPercent);
        if (cancelled) return;
        if (result.preview_session_id) {
          sessionRef.current = result.preview_session_id;
          onSessionReadyRef.current?.(result.preview_session_id);
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
  }, [files, debouncedPercent, refreshToken]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.size = pointSizeM;
      materialRef.current.needsUpdate = true;
    }
  }, [pointSizeM]);

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx || !positionsRef.current) return;
    const geom = ctx.points.geometry;
    const colorAttr = geom.getAttribute("color") as THREE.BufferAttribute;
    if (!colorAttr) return;
    const count = colorAttr.count;
    const next = applyColorMode(count, positionsRef.current, rawColorsRef.current, colorMode);
    colorAttr.array.set(next);
    colorAttr.needsUpdate = true;
  }, [colorMode, data?.count]);

  const resolvePick = useCallback(
    (
      raycaster: THREE.Raycaster,
      ctx: NonNullable<typeof sceneCtxRef.current>,
    ): { point: THREE.Vector3; vertexIndex?: number; pointIndex?: number } | null => {
      const tool = toolRef.current;
      const osnap = osnapRef.current;
      const useOsnap = osnap !== "off";
      const threshold = ctx.maxDim * (useOsnap ? 0.012 : 0.06);
      const meshObj = ctx.meshRoot.children[0] ?? null;

      if (osnap === "mesh" || tool === "mesh_add" || tool === "mesh_delete" || tool === "breakline") {
        if (meshObj) {
          const snap = snapToMesh(raycaster, meshObj, ctx.maxDim * 0.025);
          if (snap) return { point: snap.point, vertexIndex: snap.vertexIndex };
        }
      }

      if (osnap === "point" || tool === "delete_point" || tool === "add_point" || tool === "coord_point") {
        const ptSnap = snapToPointCloud(raycaster, ctx.points, threshold);
        if (ptSnap) return { point: ptSnap.point, pointIndex: ptSnap.index };
      } else {
        const ptSnap = snapToPointCloud(raycaster, ctx.points, threshold);
        if (ptSnap) return { point: ptSnap.point, pointIndex: ptSnap.index };
      }

      if (!useOsnap && (tool === "add_point" || tool === "breakline" || tool === "coord_point")) {
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
    const positions = data.positions.slice(0, count * 3);
    positionsRef.current = positions;
    rawColorsRef.current = data.colors ?? null;
    const colors = applyColorMode(count, positions, data.colors, colorModeRef.current);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
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
    camera.up.set(0, 0, 1);
    camera.position.set(maxDim * 1.2, -maxDim * 1.2, maxDim * 0.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(center);

    const savedCam = cameraSavedRef.current;
    if (savedCam) {
      camera.position.copy(savedCam.pos);
      controls.target.copy(savedCam.target);
      cameraSavedRef.current = null;
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const floor = new THREE.GridHelper(maxDim * 2.5, 20, 0x2a3444, 0x1a2230);
    floor.rotation.x = Math.PI / 2;
    floor.position.z = box.min.z - maxDim * 0.01;
    scene.add(floor);

    const axesGroup = createAxesHelper(maxDim * 0.45);
    axesGroup.visible = showAxes;
    scene.add(axesGroup);

    let basemapPlane: THREE.Mesh | null = null;
    const mapMode = effectiveBasemapMode(basemapEnabled, basemapMode);
    if (mapMode !== "off" && normMeta) {
      const planeGeom = new THREE.PlaneGeometry(maxDim * 2, maxDim * 2);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x3a4a5a,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      basemapPlane = new THREE.Mesh(planeGeom, planeMat);
      basemapPlane.renderOrder = -1000;
      basemapPlane.position.copy(center);
      basemapPlane.position.z = box.min.z - maxDim * 0.015;
      scene.add(basemapPlane);

      void buildGeoreferencedBasemap(normMeta, crsEpsg, mapMode, swapXy).then((placement) => {
        if (cancelled || !placement || !basemapPlane) return;
        basemapPlane.geometry.dispose();
        basemapPlane.geometry = new THREE.PlaneGeometry(placement.width, placement.height);
        basemapPlane.position.copy(placement.center);
        const mat = basemapPlane.material as THREE.MeshBasicMaterial;
        mat.map = placement.texture;
        mat.color.set(0xffffff);
        mat.opacity = 0.92;
        mat.needsUpdate = true;
      });
    }

    const meshRoot = new THREE.Group();
    scene.add(meshRoot);

    const breaklineGroup = new THREE.Group();
    scene.add(breaklineGroup);

    const regionGroup = new THREE.Group();
    scene.add(regionGroup);

    const annotationGroup = new THREE.Group();
    scene.add(annotationGroup);

    const gridSurfaceGroup = new THREE.Group();
    scene.add(gridSurfaceGroup);

    const snapMarker = new THREE.Mesh(
      new THREE.SphereGeometry(maxDim * 0.008, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 }),
    );
    snapMarker.visible = false;
    scene.add(snapMarker);

    const raycaster = new THREE.Raycaster();
    const pickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -center.z);

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
      annotationGroup,
      gridSurfaceGroup,
      axesGroup,
      basemapPlane,
      maxDim,
      raycaster,
      pickPlane,
    };
    viewCubeCameraRef.current = camera;

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
          const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
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
        if (normMeta) {
          const world = viewerToWorld(pos, normMeta, swapXy);
          setSnapLabel(formatWorldCoords(world));
          onSnapHoverRef.current?.(world);
        } else {
          setSnapLabel(formatSnapLabel(hit.point));
          onSnapHoverRef.current?.(pos);
        }
      } else {
        ctx.snapMarker.visible = false;
        setSnapLabel(null);
        onSnapHoverRef.current?.(null);
      }
    };

    const onClick = (event: MouseEvent) => {
      const ctx = sceneCtxRef.current;
      const tool = toolRef.current;
      if (!ctx) return;
      event.preventDefault();
      const ndc = ndcFromEvent(event, ctx.renderer.domElement);
      ctx.raycaster.setFromCamera(ndc, ctx.camera);
      const hit = resolvePick(ctx.raycaster, ctx);
      if (!hit) return;
      const pos: [number, number, number] = [hit.point.x, hit.point.y, hit.point.z];
      let rgb: [number, number, number] | undefined;
      if (hit.pointIndex != null && hit.pointIndex >= 0 && rawColorsRef.current) {
        const idx = hit.pointIndex;
        rgb = [
          rawColorsRef.current[idx * 3],
          rawColorsRef.current[idx * 3 + 1],
          rawColorsRef.current[idx * 3 + 2],
        ];
      }
      const meta: PickMeta = { vertexIndex: hit.vertexIndex, pointIndex: hit.pointIndex, rgb };
      if (tool === "navigate") {
        onInspectRef.current?.(pos, meta);
        return;
      }
      onPickRef.current?.(pos, meta);
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
      viewCubeCameraRef.current = null;
    };
  }, [data, resolvePick, showAxes, basemapEnabled, basemapMode, crsEpsg, normMeta, swapXy]);

  const handleViewCube = (dir: ViewDirection) => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;
    const dist = ctx.maxDim * 1.8;
    applyViewDirection(ctx.camera, ctx.controls, ctx.controls.target.clone(), dist, dir);
  };

  const handleViewHome = () => {
    handleViewCube("front-right");
  };

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    const sid = sessionRef.current;
    if (!ctx || !sid) return;

    while (ctx.gridSurfaceGroup.children.length) {
      const child = ctx.gridSurfaceGroup.children[0];
      ctx.gridSurfaceGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    if (!showGridSurface) return;

    let cancelled = false;
    void fetchGridSurface(sid)
      .then((grid) => {
        if (cancelled) return;
        const [nx, ny] = grid.size;
        const positions = new Float32Array(nx * ny * 3);
        let vi = 0;
        for (let iy = 0; iy < ny; iy++) {
          for (let ix = 0; ix < nx; ix++) {
            const z = grid.values[iy]?.[ix];
            positions[vi++] = grid.xs[ix] ?? grid.origin[0] + ix * grid.cell_size;
            positions[vi++] = grid.ys[iy] ?? grid.origin[1] + iy * grid.cell_size;
            positions[vi++] = Number.isFinite(z) ? z : grid.origin[0];
          }
        }
        const indices: number[] = [];
        for (let iy = 0; iy < ny - 1; iy++) {
          for (let ix = 0; ix < nx - 1; ix++) {
            const a = iy * nx + ix;
            const b = a + 1;
            const c = a + nx;
            const d = c + 1;
            const za = grid.values[iy][ix];
            const zb = grid.values[iy][ix + 1];
            const zc = grid.values[iy + 1][ix];
            const zd = grid.values[iy + 1][ix + 1];
            if (Number.isFinite(za) && Number.isFinite(zb) && Number.isFinite(zc)) {
              indices.push(a, b, c);
            }
            if (Number.isFinite(zb) && Number.isFinite(zd) && Number.isFinite(zc)) {
              indices.push(b, d, c);
            }
          }
        }
        if (indices.length === 0) return;
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          color: 0x66aa88,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          wireframe: false,
        });
        ctx.gridSurfaceGroup.add(new THREE.Mesh(geom, mat));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [showGridSurface, refreshToken, gridEnabled]);

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (ctx) ctx.axesGroup.visible = showAxes;
  }, [showAxes]);

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx || !basemapEnabled || !normMeta || !ctx.basemapPlane) return;
    const mapMode = effectiveBasemapMode(basemapEnabled, basemapMode);
    if (mapMode === "off") return;
    let cancelled = false;
    void buildGeoreferencedBasemap(normMeta, crsEpsg, mapMode, swapXy).then((placement) => {
      if (cancelled || !placement || !ctx.basemapPlane) return;
      ctx.basemapPlane.geometry.dispose();
      ctx.basemapPlane.geometry = new THREE.PlaneGeometry(placement.width, placement.height);
      ctx.basemapPlane.position.copy(placement.center);
      const mat = ctx.basemapPlane.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
      mat.map = placement.texture;
      mat.color.set(0xffffff);
      mat.opacity = 0.92;
      mat.needsUpdate = true;
    });
    return () => {
      cancelled = true;
    };
  }, [basemapEnabled, basemapMode, crsEpsg, normMeta, swapXy]);

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

  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;

    while (ctx.annotationGroup.children.length) {
      const child = ctx.annotationGroup.children[0];
      ctx.annotationGroup.remove(child);
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Points) {
          if ("geometry" in obj && obj.geometry) obj.geometry.dispose();
          if ("material" in obj && obj.material) {
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((x) => x.dispose());
            else m.dispose();
          }
        }
      });
    }

    for (const cp of coordPoints) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(ctx.maxDim * 0.01, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
      );
      m.position.set(cp.position[0], cp.position[1], cp.position[2]);
      ctx.annotationGroup.add(m);
    }

    if (measureStart) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(ctx.maxDim * 0.012, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffff00 }),
      );
      m.position.set(measureStart[0], measureStart[1], measureStart[2]);
      ctx.annotationGroup.add(m);
    }

    const measureSegs: [number[], number[]][] = [];
    for (const m of measurements) {
      if (m.type === "distance" && m.points.length >= 2) {
        measureSegs.push([m.points[0], m.points[1]]);
      } else if (m.type === "area" && m.points.length >= 2) {
        for (let i = 0; i < m.points.length; i++) {
          const j = (i + 1) % m.points.length;
          measureSegs.push([m.points[i], m.points[j]]);
        }
      }
    }
    if (polygonDraft.length >= 2) {
      for (let i = 0; i < polygonDraft.length - 1; i++) {
        measureSegs.push([polygonDraft[i], polygonDraft[i + 1]]);
      }
      if (polygonDraft.length >= 3) {
        measureSegs.push([polygonDraft[polygonDraft.length - 1], polygonDraft[0]]);
      }
    }
    const lineGeom = buildLineGeometry(measureSegs);
    if (lineGeom) {
      ctx.annotationGroup.add(
        new THREE.LineSegments(lineGeom, new THREE.LineBasicMaterial({ color: 0x66ccff })),
      );
    }
    if (polygonDraft.length >= 1) {
      const draftPos = new Float32Array(polygonDraft.length * 3);
      polygonDraft.forEach((p, i) => {
        draftPos[i * 3] = p[0];
        draftPos[i * 3 + 1] = p[1];
        draftPos[i * 3 + 2] = p[2];
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(draftPos, 3));
      ctx.annotationGroup.add(
        new THREE.Points(g, new THREE.PointsMaterial({ color: 0x66ccff, size: ctx.maxDim * 0.01 })),
      );
    }
  }, [coordPoints, measurements, polygonDraft, measureStart]);

  const osnapActive = osnapMode !== "off";
  const cursorClass =
    activeTool === "navigate"
      ? "pc-cursor-navigate"
      : osnapActive
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
              : osnapActive
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
            {tr(toolHintKey(activeTool) as "toolHint_navigate")}
            {(activeTool === "clip_box" || activeTool === "hide_region") &&
              regionStart &&
              ` · ${tr("toolRegionSecond")}`}
            {activeTool === "measure_distance" && measureStart && ` · ${tr("toolMeasureSecond")}`}
          </div>
        )}
        <div ref={mountRef} className="pc-preview-mount" />
        <ViewCube
          onSelect={handleViewCube}
          onHome={handleViewHome}
          cameraRef={viewCubeCameraRef}
        />
      </div>
    </div>
  );
}
