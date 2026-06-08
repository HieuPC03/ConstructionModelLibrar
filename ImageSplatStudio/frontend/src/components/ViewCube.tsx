import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import {
  formatWorldCoords,
  viewerToWorld,
  wcsAnchorWorld,
  worldPointToViewerVec,
  type NormMeta,
} from "../utils/coordTransform";

export type ViewDirection =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "front-right"
  | "front-left"
  | "back-right"
  | "back-left"
  | "front-right-top"
  | "front-right-bottom"
  | "front-left-top"
  | "front-left-bottom"
  | "back-right-top"
  | "back-right-bottom"
  | "back-left-top"
  | "back-left-bottom";

const VIEWS: Record<ViewDirection, { position: [number, number, number]; up: [number, number, number] }> = {
  top: { position: [0, 0, 1], up: [0, 1, 0] },
  bottom: { position: [0, 0, -1], up: [0, -1, 0] },
  front: { position: [0, -1, 0], up: [0, 0, 1] },
  back: { position: [0, 1, 0], up: [0, 0, 1] },
  left: { position: [-1, 0, 0], up: [0, 0, 1] },
  right: { position: [1, 0, 0], up: [0, 0, 1] },
  "front-right": { position: [0.7, -0.7, 0.35], up: [0, 0, 1] },
  "front-left": { position: [-0.7, -0.7, 0.35], up: [0, 0, 1] },
  "back-right": { position: [0.7, 0.7, 0.35], up: [0, 0, 1] },
  "back-left": { position: [-0.7, 0.7, 0.35], up: [0, 0, 1] },
  "front-right-top": { position: [0.6, -0.6, 0.6], up: [0, 0, 1] },
  "front-right-bottom": { position: [0.6, -0.6, -0.6], up: [0, 0, 1] },
  "front-left-top": { position: [-0.6, -0.6, 0.6], up: [0, 0, 1] },
  "front-left-bottom": { position: [-0.6, -0.6, -0.6], up: [0, 0, 1] },
  "back-right-top": { position: [0.6, 0.6, 0.6], up: [0, 0, 1] },
  "back-right-bottom": { position: [0.6, 0.6, -0.6], up: [0, 0, 1] },
  "back-left-top": { position: [-0.6, 0.6, 0.6], up: [0, 0, 1] },
  "back-left-bottom": { position: [-0.6, 0.6, -0.6], up: [0, 0, 1] },
};

interface ViewCubeProps {
  onSelect: (dir: ViewDirection) => void;
  onHome?: () => void;
  onDragRotate?: (deltaX: number, deltaY: number) => void;
  onRotateZ?: (radians: number) => void;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
}

function makeFaceTexture(label: string, bg: string, textColor = "#1e293b"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, "#e8eaef");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(71,85,105,0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 124, 124);
  ctx.fillStyle = textColor;
  ctx.font = "bold 18px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function faceDirection(materialIndex: number): ViewDirection | null {
  const map: Record<number, ViewDirection> = {
    0: "right",
    1: "left",
    2: "top",
    3: "bottom",
    4: "front",
    5: "back",
  };
  return map[materialIndex] ?? null;
}

const CORNER_DIRS: ViewDirection[] = [
  "front-right-top",
  "front-left-top",
  "back-right-top",
  "back-left-top",
  "front-right-bottom",
  "front-left-bottom",
  "back-right-bottom",
  "back-left-bottom",
];

export function ViewCube({ onSelect, onHome, onDragRotate, onRotateZ, cameraRef }: ViewCubeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onDragRef = useRef(onDragRotate);
  onSelectRef.current = onSelect;
  onDragRef.current = onDragRotate;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const size = 108;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    cam.position.set(2.4, -2.4, 2.0);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, 0, 0);

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const faceMats = [
      new THREE.MeshBasicMaterial({ map: makeFaceTexture("RIGHT", "#d4d4d8"), transparent: true, opacity: 0.98 }),
      new THREE.MeshBasicMaterial({ map: makeFaceTexture("LEFT", "#d4d4d8"), transparent: true, opacity: 0.98 }),
      new THREE.MeshBasicMaterial({ map: makeFaceTexture("TOP", "#bbf7d0"), transparent: true, opacity: 0.98 }),
      new THREE.MeshBasicMaterial({ map: makeFaceTexture("BOTTOM", "#fecaca"), transparent: true, opacity: 0.98 }),
      new THREE.MeshBasicMaterial({ map: makeFaceTexture("FRONT", "#bfdbfe"), transparent: true, opacity: 0.98 }),
      new THREE.MeshBasicMaterial({ map: makeFaceTexture("BACK", "#bfdbfe"), transparent: true, opacity: 0.98 }),
    ];

    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), faceMats);
    cubeGroup.add(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 }),
    );
    cubeGroup.add(edges);

    const pickables: THREE.Object3D[] = [cube];
    const cornerGroup = new THREE.Group();
    const cornerPositions: [number, number, number][] = [
      [1, -1, 1],
      [-1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
      [1, -1, -1],
      [-1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
    ];
    cornerPositions.forEach((p, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      m.position.set(p[0] * 0.52, p[1] * 0.52, p[2] * 0.52);
      m.userData.viewDir = CORNER_DIRS[i];
      cornerGroup.add(m);
      pickables.push(m);
    });
    cubeGroup.add(cornerGroup);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.88, 64),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.58;
    scene.add(ring);

    const syncQuat = new THREE.Quaternion();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragStart: { x: number; y: number } | null = null;
    let dragging = false;
    let hoverFace: number | null = null;

    const setFaceHighlight = (idx: number | null) => {
      if (hoverFace === idx) return;
      if (hoverFace != null && hoverFace >= 0 && hoverFace < faceMats.length) {
        faceMats[hoverFace].opacity = 0.98;
        faceMats[hoverFace].color.set(0xffffff);
      }
      hoverFace = idx;
      if (idx != null && idx >= 0 && idx < faceMats.length) {
        faceMats[idx].opacity = 1;
        faceMats[idx].color.set(0xfff3cd);
      }
    };

    const pickView = (event: MouseEvent): ViewDirection | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, cam);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits.length === 0) return null;
      const obj = hits[0].object;
      if (obj.userData.viewDir) return obj.userData.viewDir as ViewDirection;
      if (obj === cube && hits[0].face) return faceDirection(hits[0].face.materialIndex);
      return null;
    };

    const onDown = (event: MouseEvent) => {
      event.preventDefault();
      dragStart = { x: event.clientX, y: event.clientY };
      dragging = false;
    };

    const onMove = (event: MouseEvent) => {
      if (dragStart) {
        const dx = event.clientX - dragStart.x;
        const dy = event.clientY - dragStart.y;
        if (!dragging && Math.hypot(dx, dy) > 4) dragging = true;
        if (dragging) {
          onDragRef.current?.(event.movementX, event.movementY);
        }
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, cam);
      const hits = raycaster.intersectObject(cube, false);
      if (hits.length > 0 && hits[0].face) {
        setFaceHighlight(hits[0].face.materialIndex);
      } else {
        setFaceHighlight(null);
      }
    };

    const onUp = (event: MouseEvent) => {
      if (!dragging && dragStart) {
        const dir = pickView(event);
        if (dir) onSelectRef.current(dir);
      }
      dragStart = null;
      dragging = false;
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    renderer.domElement.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const mainCam = cameraRef.current;
      if (mainCam) {
        syncQuat.copy(mainCam.quaternion).invert();
        cubeGroup.quaternion.copy(syncQuat);
      }
      renderer.render(scene, cam);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cube.geometry.dispose();
      faceMats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      edges.geometry.dispose();
      (edges.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      cornerGroup.children.forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [cameraRef]);

  return (
    <div className="tp-view-cube" title="ViewCube (AutoCAD style)">
      <div className="tp-view-cube-compass">
        <button
          type="button"
          className="tp-compass-arrow tp-compass-arrow-n"
          title="Rotate 90°"
          onClick={() => onRotateZ?.(Math.PI / 2)}
        >
          ▲
        </button>
        <button
          type="button"
          className="tp-compass-arrow tp-compass-arrow-s"
          title="Rotate 90°"
          onClick={() => onRotateZ?.(-Math.PI / 2)}
        >
          ▼
        </button>
        <button
          type="button"
          className="tp-compass-arrow tp-compass-arrow-e"
          title="Rotate 90°"
          onClick={() => onRotateZ?.(-Math.PI / 2)}
        >
          ▶
        </button>
        <button
          type="button"
          className="tp-compass-arrow tp-compass-arrow-w"
          title="Rotate 90°"
          onClick={() => onRotateZ?.(Math.PI / 2)}
        >
          ◀
        </button>
        <span className="tp-compass-n">N</span>
        <span className="tp-compass-e">E</span>
        <span className="tp-compass-s">S</span>
        <span className="tp-compass-w">W</span>
        <div ref={mountRef} className="tp-view-cube-canvas" />
      </div>
      <div className="tp-view-cube-footer">
        <button type="button" className="tp-view-cube-wcs" title="World Coordinate System (WCS)">
          WCS
        </button>
        {onHome && (
          <button type="button" className="tp-view-cube-home" onClick={onHome} title="Home view">
            ⌂
          </button>
        )}
      </div>
    </div>
  );
}

export function applyViewDirection(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  target: THREE.Vector3,
  distance: number,
  dir: ViewDirection,
): void {
  const v = VIEWS[dir];
  const pos = new THREE.Vector3(...v.position).normalize().multiplyScalar(distance).add(target);
  camera.position.copy(pos);
  camera.up.set(v.up[0], v.up[1], v.up[2]);
  camera.lookAt(target);
  controls.update();
}

const ORBIT_BASE_SPEED = 0.012;

export function rotateCameraOrbit(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  deltaX: number,
  deltaY: number,
  sensitivity = 1,
): void {
  const speed = ORBIT_BASE_SPEED * Math.max(0.05, Math.min(2, sensitivity));
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= deltaX * speed;
  spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi + deltaY * speed));
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  camera.up.set(0, 0, 1);
  camera.lookAt(controls.target);
  controls.update();
}

/** Fit perspective camera to an axis-aligned bounding box (Z-up). */
export function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  box: THREE.Box3,
  padding = 1.25,
): void {
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const dist = (maxDim * padding) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  controls.target.copy(center);
  camera.up.set(0, 0, 1);
  camera.position.set(center.x + dist * 0.65, center.y - dist * 0.65, center.z + dist * 0.45);
  camera.lookAt(center);
  controls.update();
}

/** Bounding box from a subset of interleaved xyz positions. */
export function boundingBoxFromPositions(
  positions: Float32Array | number[],
  startIndex = 0,
  count?: number,
): THREE.Box3 {
  const box = new THREE.Box3();
  const total = Math.floor(positions.length / 3);
  const end = count != null ? Math.min(startIndex + count, total) : total;
  const v = new THREE.Vector3();
  for (let i = startIndex; i < end; i++) {
    v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    box.expandByPoint(v);
  }
  return box;
}

export function rotateCameraAroundZ(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  radians: number,
): void {
  const offset = camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(new THREE.Vector3(0, 0, 1), radians);
  camera.position.copy(controls.target).add(offset);
  const up = new THREE.Vector3(0, 0, 1);
  camera.up.copy(up);
  camera.lookAt(controls.target);
  controls.update();
}

/** WCS axes at real-world anchor — directions match Cartesian X/Y/Z (Z-up). */
export function createWorldAxesHelper(
  axisLength: number,
  meta: NormMeta,
  swapXy = false,
): THREE.Group {
  const g = new THREE.Group();
  const anchorWorld = wcsAnchorWorld(meta);
  const anchor = worldPointToViewerVec(anchorWorld, meta, swapXy);
  g.position.set(anchor.x, anchor.y, anchor.z);

  const makeAxis = (color: number, to: THREE.Vector3) => {
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), to]);
    g.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color, linewidth: 2 })));
  };
  makeAxis(0xff3333, new THREE.Vector3(axisLength, 0, 0));
  makeAxis(0x33cc33, new THREE.Vector3(0, axisLength, 0));
  makeAxis(0x3388ff, new THREE.Vector3(0, 0, axisLength));

  const tipViewer = (dx: number, dy: number, dz: number): [number, number, number] => {
    return viewerToWorld([anchor.x + dx, anchor.y + dy, anchor.z + dz], meta, swapXy);
  };

  const makeLabel = (text: string, color: string, pos: THREE.Vector3) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "bold 22px monospace";
    ctx.fillText(text, 4, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(axisLength * 0.35, axisLength * 0.12, 1);
    g.add(sprite);
  };

  const tx = tipViewer(axisLength, 0, 0);
  const ty = tipViewer(0, axisLength, 0);
  const tz = tipViewer(0, 0, axisLength);
  makeLabel(`X ${tx[0].toFixed(1)}`, "#ff3333", new THREE.Vector3(axisLength * 1.08, 0, 0));
  makeLabel(`Y ${ty[1].toFixed(1)}`, "#33cc33", new THREE.Vector3(0, axisLength * 1.08, 0));
  makeLabel(`Z ${tz[2].toFixed(1)}`, "#3388ff", new THREE.Vector3(0, 0, axisLength * 1.08));

  const originLabel = formatWorldCoords(anchorWorld, 2);
  makeLabel(`WCS ${originLabel}`, "#64748b", new THREE.Vector3(0, -axisLength * 0.15, 0));

  return g;
}

/** Legacy viewer-local axes (fallback when no world metadata). */
export function createAxesHelper(size: number): THREE.Group {
  const g = new THREE.Group();
  const makeAxis = (color: number, from: THREE.Vector3, to: THREE.Vector3) => {
    const geom = new THREE.BufferGeometry().setFromPoints([from, to]);
    g.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color })));
  };
  makeAxis(0xff4444, new THREE.Vector3(0, 0, 0), new THREE.Vector3(size, 0, 0));
  makeAxis(0x44ff44, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, size, 0));
  makeAxis(0x4488ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, size));

  const makeLabel = (text: string, color: string, pos: THREE.Vector3) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "bold 48px sans-serif";
    ctx.fillText(text, 12, 48);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(size * 0.15, size * 0.15, 1);
    g.add(sprite);
  };
  makeLabel("X", "#ff4444", new THREE.Vector3(size * 1.1, 0, 0));
  makeLabel("Y", "#44ff44", new THREE.Vector3(0, size * 1.1, 0));
  makeLabel("Z", "#4488ff", new THREE.Vector3(0, 0, size * 1.1));
  return g;
}
