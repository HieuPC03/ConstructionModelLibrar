import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

interface OrientationGizmoProps {
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  onDragRotate?: (deltaX: number, deltaY: number) => void;
}

const AXIS_LEN = 0.62;
const GRID_SPAN = 0.55;

/** Project fixed Z-up WCS axes onto 2D canvas using main camera orientation. */
function drawOrientationGizmo(
  ctx: CanvasRenderingContext2D,
  size: number,
  mainCam: THREE.Camera,
): void {
  mainCam.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(mainCam.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(mainCam.matrixWorld, 1).normalize();
  const world = new THREE.Vector3();

  const cx = size / 2;
  const cy = size / 2;
  const pxScale = size * 0.34;

  const project = (x: number, y: number, z: number) => {
    world.set(x, y, z);
    return { x: cx + world.dot(right) * pxScale, y: cy - world.dot(up) * pxScale };
  };

  const drawSeg = (a: { x: number; y: number }, b: { x: number; y: number }, color: string, width = 1.5) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  ctx.clearRect(0, 0, size, size);

  const origin = project(0, 0, 0);
  const cubeHalf = size * 0.09;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.strokeStyle = "rgba(136,136,136,0.9)";
  ctx.lineWidth = 1;
  ctx.fillRect(origin.x - cubeHalf, origin.y - cubeHalf, cubeHalf * 2, cubeHalf * 2);
  ctx.strokeRect(origin.x - cubeHalf, origin.y - cubeHalf, cubeHalf * 2, cubeHalf * 2);

  ctx.strokeStyle = "rgba(204,204,204,0.9)";
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    const t = i * GRID_SPAN;
    drawSeg(project(-GRID_SPAN, t, 0), project(GRID_SPAN, t, 0), "rgba(204,204,204,0.9)", 1);
    drawSeg(project(t, -GRID_SPAN, 0), project(t, GRID_SPAN, 0), "rgba(204,204,204,0.9)", 1);
  }

  const axes: { dir: [number, number, number]; color: string; label: string }[] = [
    { dir: [1, 0, 0], color: "#ff3333", label: "X" },
    { dir: [0, 1, 0], color: "#33cc33", label: "Y" },
    { dir: [0, 0, 1], color: "#3388ff", label: "Z" },
  ];

  for (const { dir, color, label } of axes) {
    const end = project(dir[0] * AXIS_LEN, dir[1] * AXIS_LEN, dir[2] * AXIS_LEN);
    drawSeg(origin, end, color, 2.2);
    const tip = project(dir[0] * AXIS_LEN * 1.18, dir[1] * AXIS_LEN * 1.18, dir[2] * AXIS_LEN * 1.18);
    ctx.fillStyle = color;
    ctx.font = "bold 13px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, tip.x, tip.y);
  }
}

export function OrientationGizmo({ cameraRef, onDragRotate }: OrientationGizmoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDragRef = useRef(onDragRotate);
  onDragRef.current = onDragRotate;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 88;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let dragStart: { x: number; y: number } | null = null;
    let dragging = false;

    const onDown = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragStart = { x: event.clientX, y: event.clientY };
      dragging = false;
      canvas.style.cursor = "grabbing";
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
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.style.cursor = "grab";

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const mainCam = cameraRef.current;
      if (mainCam && ctx) drawOrientationGizmo(ctx, size, mainCam);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [cameraRef]);

  return (
    <div className="tp-orient-gizmo" title="XYZ">
      <canvas ref={canvasRef} className="tp-orient-gizmo-canvas" />
    </div>
  );
}
