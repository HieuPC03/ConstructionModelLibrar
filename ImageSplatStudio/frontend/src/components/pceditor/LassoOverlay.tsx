import { useEffect, useRef } from "react";

interface LassoOverlayProps {
  active: boolean;
  onComplete: (polygonNdc: [number, number][]) => void;
  onCancel?: () => void;
}

function drawLasso(canvas: HTMLCanvasElement, pts: [number, number][]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (pts.length < 2) return;
  ctx.strokeStyle = "#22c55e";
  ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function LassoOverlay({ active, onComplete, onCancel }: LassoOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<[number, number][]>([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      pointsRef.current = [];
      drawingRef.current = false;
    }
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      drawLasso(canvas, pointsRef.current);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const toLocal = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      drawingRef.current = true;
      pointsRef.current = [toLocal(e)];
      drawLasso(canvas, pointsRef.current);
    };

    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const p = toLocal(e);
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 4) {
        pointsRef.current.push(p);
        drawLasso(canvas, pointsRef.current);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      drawingRef.current = false;
      const pts = pointsRef.current;
      if (pts.length < 3) {
        pointsRef.current = [];
        drawLasso(canvas, []);
        return;
      }
      const w = canvas.width;
      const h = canvas.height;
      const ndc: [number, number][] = pts.map(([x, y]) => [
        (x / w) * 2 - 1,
        -(y / h) * 2 + 1,
      ]);
      pointsRef.current = [];
      drawLasso(canvas, []);
      onComplete(ndc);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pointsRef.current = [];
        drawingRef.current = false;
        drawLasso(canvas, []);
        onCancel?.();
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, onComplete, onCancel]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pc-lasso-overlay"
      aria-label="Lasso selection"
    />
  );
}
