import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "iss-sidebar-width";

interface ResizableSplitProps {
  sidebar: ReactNode;
  main: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxRatio?: number;
}

export function ResizableSplit({
  sidebar,
  main,
  defaultWidth = 300,
  minWidth = 220,
  maxRatio = 0.55,
}: ResizableSplitProps) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const n = Number(saved);
        if (n >= minWidth) return n;
      }
    } catch {
      /* ignore */
    }
    return defaultWidth;
  });
  const dragging = useRef(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  const widthRef = useRef(width);
  widthRef.current = width;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.classList.add("iss-resizing");
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const maxW = rect.width * maxRatio;
      const next = Math.min(Math.max(e.clientX - rect.left, minWidth), maxW);
      setWidth(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("iss-resizing");
      try {
        localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("iss-resizing");
    };
  }, [width, minWidth, maxRatio]);

  return (
    <div ref={layoutRef} className="resizable-layout">
      <aside className="resizable-sidebar" style={{ width }}>
        {sidebar}
      </aside>
      <div
        className="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={onMouseDown}
      />
      <section className="resizable-main">{main}</section>
    </div>
  );
}
