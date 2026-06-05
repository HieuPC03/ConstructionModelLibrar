import { useEffect, useRef } from "react";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";

interface SplatViewerProps {
  url: string;
}

export function SplatViewer({ url }: SplatViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    const absoluteUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: mount,
      cameraUp: [0, -1, 0],
      initialCameraPosition: [0, -2.5, 4],
      initialCameraLookAt: [0, 0, 0],
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      dynamicScene: false,
      antialiased: false,
      selfDrivenMode: true,
      splatRenderMode: GaussianSplats3D.SplatRenderMode.ThreeD,
    });

    viewer
      .addSplatScene(absoluteUrl, {
        splatAlphaRemovalThreshold: 1,
        showLoadingUI: true,
        progressiveLoad: false,
      })
      .then(() => {
        if (!cancelled) viewer.start();
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("Failed to load splat scene:", err);
      });

    return () => {
      cancelled = true;
      viewer.dispose();
    };
  }, [url]);

  return (
    <div className="splat-viewer">
      <div ref={mountRef} className="splat-viewer-mount" />
    </div>
  );
}
