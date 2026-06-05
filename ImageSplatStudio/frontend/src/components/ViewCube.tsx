import { useEffect, useRef } from "react";
import * as THREE from "three";

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
  | "back-left";

/** Z-up views (Civil 3D / AutoCAD convention). */
const VIEWS: Record<ViewDirection, { position: [number, number, number]; up: [number, number, number] }> = {
  top: { position: [0, 0, 1], up: [0, 1, 0] },
  bottom: { position: [0, 0, -1], up: [0, -1, 0] },
  front: { position: [0, -1, 0], up: [0, 0, 1] },
  back: { position: [0, 1, 0], up: [0, 0, 1] },
  left: { position: [-1, 0, 0], up: [0, 0, 1] },
  right: { position: [1, 0, 0], up: [0, 0, 1] },
  "front-right": { position: [0.7, -0.7, 0.5], up: [0, 0, 1] },
  "front-left": { position: [-0.7, -0.7, 0.5], up: [0, 0, 1] },
  "back-right": { position: [0.7, 0.7, 0.5], up: [0, 0, 1] },
  "back-left": { position: [-0.7, 0.7, 0.5], up: [0, 0, 1] },
};

interface ViewCubeProps {
  onSelect: (dir: ViewDirection) => void;
  camera?: THREE.PerspectiveCamera | null;
}

function makeFaceTexture(label: string, bg: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 124, 124);
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 22px Segoe UI, sans-serif";
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

export function ViewCube({ onSelect, camera }: ViewCubeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const size = 120;
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    cam.position.set(2.2, -2.2, 1.8);
    cam.up.set(0, 0, 1);

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      [
        new THREE.MeshBasicMaterial({ map: makeFaceTexture("RIGHT", "#fde68a"), transparent: true, opacity: 0.92 }),
        new THREE.MeshBasicMaterial({ map: makeFaceTexture("LEFT", "#fde68a"), transparent: true, opacity: 0.92 }),
        new THREE.MeshBasicMaterial({ map: makeFaceTexture("TOP", "#bbf7d0"), transparent: true, opacity: 0.92 }),
        new THREE.MeshBasicMaterial({ map: makeFaceTexture("BOTTOM", "#fecaca"), transparent: true, opacity: 0.92 }),
        new THREE.MeshBasicMaterial({ map: makeFaceTexture("FRONT", "#bfdbfe"), transparent: true, opacity: 0.92 }),
        new THREE.MeshBasicMaterial({ map: makeFaceTexture("BACK", "#bfdbfe"), transparent: true, opacity: 0.92 }),
      ],
    );
    scene.add(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: 0x64748b }),
    );
    scene.add(edges);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.05, 64),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.55;
    scene.add(ring);

    const addCompassLabel = (text: string, angle: number, radius: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#334155";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      const rad = (angle * Math.PI) / 180;
      sprite.position.set(Math.sin(rad) * radius, Math.cos(rad) * radius, -0.52);
      sprite.scale.set(0.22, 0.22, 1);
      scene.add(sprite);
    };
    addCompassLabel("N", 0, 1.18);
    addCompassLabel("E", 90, 1.18);
    addCompassLabel("S", 180, 1.18);
    addCompassLabel("W", 270, 1.18);

    cam.lookAt(0, 0, 0);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, cam);
      const hits = raycaster.intersectObject(cube);
      if (hits.length > 0 && hits[0].face) {
        const dir = faceDirection(hits[0].face.materialIndex);
        if (dir) onSelectRef.current(dir);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (camera) {
        const q = camera.quaternion.clone();
        cube.quaternion.copy(q.invert());
      }
      renderer.render(scene, cam);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("click", onClick);
      cube.geometry.dispose();
      (cube.material as THREE.MeshBasicMaterial[]).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      edges.geometry.dispose();
      (edges.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [camera]);

  return (
    <div className="tp-view-cube" title="ViewCube">
      <div ref={mountRef} className="tp-view-cube-canvas" />
      <div className="tp-view-cube-wcs">WCS</div>
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
