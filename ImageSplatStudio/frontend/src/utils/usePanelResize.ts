import { useCallback, useEffect, useState } from "react";

function readStored(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    /* ignore */
  }
}

export function useHorizontalResize(
  storageKey: string,
  initial: number,
  min: number,
  max: number,
  invert = false,
) {
  const [size, setSize] = useState(() => readStored(storageKey, initial));

  useEffect(() => {
    setSize((s) => Math.max(min, Math.min(max, s)));
  }, [min, max]);

  const onResizeStart = useCallback(
    (e: React.MouseEvent, startSize = size) => {
      e.preventDefault();
      document.body.classList.add("iss-resizing-h");
      const startX = e.clientX;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const next = invert ? startSize - delta : startSize + delta;
        const clamped = Math.max(min, Math.min(max, next));
        setSize(clamped);
        store(storageKey, clamped);
      };
      const onUp = () => {
        document.body.classList.remove("iss-resizing-h");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [invert, max, min, size, storageKey],
  );

  return { size, setSize, onResizeStart };
}

export function useVerticalResize(storageKey: string, initial: number, min: number, max: number) {
  const [size, setSize] = useState(() => readStored(storageKey, initial));

  useEffect(() => {
    setSize((s) => Math.max(min, Math.min(max, s)));
  }, [min, max]);

  const onResizeStart = useCallback(
    (e: React.MouseEvent, startSize = size) => {
      e.preventDefault();
      document.body.classList.add("iss-resizing-v");
      const startY = e.clientY;
      const onMove = (ev: MouseEvent) => {
        const next = startSize + (ev.clientY - startY);
        const clamped = Math.max(min, Math.min(max, next));
        setSize(clamped);
        store(storageKey, clamped);
      };
      const onUp = () => {
        document.body.classList.remove("iss-resizing-v");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [max, min, size, storageKey],
  );

  return { size, setSize, onResizeStart };
}
