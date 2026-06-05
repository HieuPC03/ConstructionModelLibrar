import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useI18n } from "../i18n/I18nProvider";
import {
  fetchPreviewGeometry,
  previewPointClouds,
  type PointCloudPreviewGeometry,
  type PointCloudPreviewMeta,
} from "../api";
import { formatFileSize } from "../utils/pointcloud";

const DEFAULT_PERCENT = 20;
const DEFAULT_POINT_SIZE_M = 0.3;
const MIN_POINT_SIZE_M = 0.1;
const MAX_POINT_SIZE_M = 1.0;

type PreviewData = PointCloudPreviewMeta & PointCloudPreviewGeometry;

interface PointCloudPreviewProps {
  files: File[];
}

export function PointCloudPreview({ files }: PointCloudPreviewProps) {
  const { tr } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [samplePercent, setSamplePercent] = useState(DEFAULT_PERCENT);
  const [debouncedPercent, setDebouncedPercent] = useState(DEFAULT_PERCENT);
  const [pointSizeM, setPointSizeM] = useState(DEFAULT_POINT_SIZE_M);

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
  }, [files, debouncedPercent]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.size = pointSizeM;
      materialRef.current.needsUpdate = true;
    }
  }, [pointSizeM]);

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

    const material = new THREE.PointsMaterial({
      size: pointSizeM,
      vertexColors: true,
      sizeAttenuation: true,
    });
    materialRef.current = material;
    scene.add(new THREE.Points(geometry, material));

    const camera = new THREE.PerspectiveCamera(50, 1, maxDim * 0.001, maxDim * 100);
    camera.position.set(maxDim * 1.4, maxDim * 1.0, maxDim * 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const grid = new THREE.GridHelper(maxDim * 2.5, 20, 0x2a3444, 0x1a2230);
    scene.add(grid);

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
      controls.dispose();
      geometry.dispose();
      material.dispose();
      materialRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [data]);

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
              {tr("pcPreviewPointSize")} <strong>{pointSizeM.toFixed(2)} m</strong>
            </label>
            <input
              id="pc-point-size"
              className="pc-sample-slider"
              type="range"
              min={MIN_POINT_SIZE_M}
              max={MAX_POINT_SIZE_M}
              step={0.05}
              value={pointSizeM}
              disabled={!data}
              onChange={(e) => setPointSizeM(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
      <div className="pc-preview-viewport">
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
        <div ref={mountRef} className="pc-preview-mount" />
      </div>
    </div>
  );
}
