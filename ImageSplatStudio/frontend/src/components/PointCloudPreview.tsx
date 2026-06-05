import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useI18n } from "../i18n/I18nProvider";
import { previewPointClouds, type PointCloudPreviewData } from "../api";
import { formatFileSize } from "../utils/pointcloud";

interface PointCloudPreviewProps {
  files: File[];
}

export function PointCloudPreview({ files }: PointCloudPreviewProps) {
  const { tr } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PointCloudPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    previewPointClouds(files)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [files]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !data?.positions.length) return;

    let cancelled = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080c);

    const positions = new Float32Array(data.positions.length * 3);
    const colors = new Float32Array(data.positions.length * 3);
    for (let i = 0; i < data.positions.length; i++) {
      const [x, y, z] = data.positions[i];
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      if (data.colors?.[i]) {
        colors[i * 3] = data.colors[i][0] / 255;
        colors[i * 3 + 1] = data.colors[i][1] / 255;
        colors[i * 3 + 2] = data.colors[i][2] / 255;
      } else {
        const t = i / Math.max(data.positions.length - 1, 1);
        colors[i * 3] = 0.45 + t * 0.3;
        colors[i * 3 + 1] = 0.55 + t * 0.2;
        colors[i * 3 + 2] = 0.95;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const pointSize = Math.max(maxDim / 200, 0.004);

    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: true,
    });
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
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [data]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="pc-preview">
      <div className="pc-preview-header">
        <div>
          <h3>{tr("pcPreviewTitle")}</h3>
          <p className="muted">
            {files.length} {tr("pcFilesSelected")} · {formatFileSize(totalSize)}
            {data && (
              <>
                {" "}
                · {data.total_points.toLocaleString()} {tr("pcPreviewPoints")}
                {" "}
                ({tr("pcPreviewShowing")} {data.preview_count.toLocaleString()} = 20%)
              </>
            )}
          </p>
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
