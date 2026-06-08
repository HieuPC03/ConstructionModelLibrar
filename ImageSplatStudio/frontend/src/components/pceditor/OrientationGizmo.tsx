import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

interface OrientationGizmoProps {
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  onDragRotate?: (deltaX: number, deltaY: number) => void;
}

function axisColorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function makeLabel(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 18px Segoe UI, system-ui, sans-serif";
  ctx.fillStyle = axisColorHex(color);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 16, 17);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.24, 0.24, 1);
  return sprite;
}

/** Z-up WCS axes + horizontal XY grid (TREND-POINT style). */
function createGizmoGroup(): THREE.Group {
  const group = new THREE.Group();

  const gridLines: number[] = [];
  const span = 0.55;
  for (let i = -1; i <= 1; i++) {
    const t = i * span;
    gridLines.push(-span, t, 0, span, t, 0);
    gridLines.push(t, -span, 0, t, span, 0);
  }
  const gridGeom = new THREE.BufferGeometry();
  gridGeom.setAttribute("position", new THREE.Float32BufferAttribute(gridLines, 3));
  group.add(
    new THREE.LineSegments(
      gridGeom,
      new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.9 }),
    ),
  );

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 }),
  );
  group.add(cube);
  group.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.17, 0.17, 0.17)),
      new THREE.LineBasicMaterial({ color: 0x888888 }),
    ),
  );

  const addAxis = (dir: THREE.Vector3, color: number, label: string) => {
    const len = 0.62;
    const end = dir.clone().multiplyScalar(len);
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), end]),
        new THREE.LineBasicMaterial({ color }),
      ),
    );
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.11, 10),
      new THREE.MeshBasicMaterial({ color }),
    );
    cone.position.copy(end);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.add(cone);
    const lbl = makeLabel(label, color);
    lbl.position.copy(end.clone().multiplyScalar(1.18));
    group.add(lbl);
  };

  addAxis(new THREE.Vector3(1, 0, 0), 0xff3333, "X");
  addAxis(new THREE.Vector3(0, 1, 0), 0x33cc33, "Y");
  addAxis(new THREE.Vector3(0, 0, 1), 0x3388ff, "Z");

  return group;
}

export function OrientationGizmo({ cameraRef, onDragRotate }: OrientationGizmoProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onDragRef = useRef(onDragRotate);
  onDragRef.current = onDragRotate;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const size = 88;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    cam.up.set(0, 0, 1);

    const gizmo = createGizmoGroup();
    scene.add(gizmo);

    const lookDir = new THREE.Vector3();
    const camDistance = 2.4;

    let dragStart: { x: number; y: number } | null = null;
    let dragging = false;

    const onDown = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragStart = { x: event.clientX, y: event.clientY };
      dragging = false;
      renderer.domElement.style.cursor = "grabbing";
    };

    const onMove = (event: MouseEvent) => {
      if (!dragStart) return;
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (!dragging && Math.hypot(dx, dy) > 3) dragging = true;
      if (dragging) onDragRef.current?.(event.movementX, event.movementY);
    };

    const onUp = () => {
      dragStart = null;
      dragging = false;
      renderer.domElement.style.cursor = "grab";
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    renderer.domElement.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    renderer.domElement.style.cursor = "grab";

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const mainCam = cameraRef.current;
      if (mainCam) {
        mainCam.updateMatrixWorld();
        mainCam.getWorldDirection(lookDir);
        cam.position.copy(lookDir).multiplyScalar(-camDistance);
        cam.up.set(0, 0, 1);
        cam.lookAt(0, 0, 0);
      }
      renderer.render(scene, cam);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      gizmo.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        } else if (obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        } else if (obj instanceof THREE.Sprite) {
          (obj.material as THREE.SpriteMaterial).map?.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [cameraRef]);

  return (
    <div className="tp-orient-gizmo" title="XYZ">
      <div ref={mountRef} className="tp-orient-gizmo-canvas" />
    </div>
  );
}
