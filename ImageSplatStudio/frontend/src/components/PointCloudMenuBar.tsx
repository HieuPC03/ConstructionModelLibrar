import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  editorCleanOutliers,
  editorCreateMesh,
  editorExportLasUrl,
  editorExportTxtUrl,
  editorFilterDensity,
  editorFilterGround,
  editorHideRegion,
  editorShowAll,
  editorSplit,
  editorSwapXy,
  type EditorProperties,
} from "../api/editor";
import { triggerDownload } from "../utils/export";

interface PointCloudMenuBarProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
}

export function PointCloudMenuBar({
  sessionId,
  properties,
  onUpdated,
  onRefreshPreview,
  onError,
}: PointCloudMenuBarProps) {
  const { tr } = useI18n();
  const [busy, setBusy] = useState(false);

  const disabled = !sessionId || busy;

  const run = async (fn: () => Promise<EditorProperties>) => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const props = await fn();
      onUpdated(props);
      onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const mid = (axis: number) => {
    if (!properties) return 0;
    const mn = properties.bounds.min[axis];
    const mx = properties.bounds.max[axis];
    return (mn + mx) / 2;
  };

  return (
    <nav className="pc-menu-bar" aria-label={tr("pcMenuLabel")}>
      <div className="pc-menu-group">
        <span className="pc-menu-label">{tr("pcMenuFile")}</span>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => sessionId && triggerDownload(editorExportLasUrl(sessionId), "pointcloud.las")}
        >
          {tr("pcMenuExportLas")}
        </button>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => sessionId && triggerDownload(editorExportTxtUrl(sessionId), "pointcloud.txt")}
        >
          {tr("pcMenuExportTxt")}
        </button>
      </div>

      <div className="pc-menu-group">
        <span className="pc-menu-label">{tr("pcMenuEdit")}</span>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => void run(() => editorSwapXy(sessionId!))}
        >
          {tr("pcMenuSwapXy")} {properties?.swap_xy ? "✓" : ""}
        </button>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => void run(() => editorCleanOutliers(sessionId!))}
        >
          {tr("pcMenuCleanPoints")}
        </button>
      </div>

      <div className="pc-menu-group">
        <span className="pc-menu-label">{tr("pcMenuFilter")}</span>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => void run(() => editorFilterDensity(sessionId!, 0.05, 5))}
        >
          {tr("pcMenuFilterDensity")}
        </button>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => void run(() => editorFilterGround(sessionId!, 1.0, 0.5))}
        >
          {tr("pcMenuFilterGround")}
        </button>
      </div>

      <div className="pc-menu-group">
        <span className="pc-menu-label">{tr("pcMenuTools")}</span>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => void run(() => editorSplit(sessionId!, 0, mid(0)))}
        >
          {tr("pcMenuSplit")}
        </button>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => {
            if (!properties || !sessionId) return;
            const mn = properties.bounds.min as [number, number, number];
            const mx = properties.bounds.max as [number, number, number];
            const cx = (mn[0] + mx[0]) / 2;
            const cy = (mn[1] + mx[1]) / 2;
            const cz = (mn[2] + mx[2]) / 2;
            const q = 0.25;
            void run(() =>
              editorHideRegion(sessionId, [cx, cy, cz], [
                mx[0] - (mx[0] - mn[0]) * q,
                mx[1] - (mx[1] - mn[1]) * q,
                mx[2] - (mx[2] - mn[2]) * q,
              ]),
            );
          }}
        >
          {tr("pcMenuHideRegion")}
        </button>
        <button
          type="button"
          className="pc-menu-btn"
          disabled={disabled}
          onClick={() => void run(() => editorShowAll(sessionId!))}
        >
          {tr("pcMenuShowAll")}
        </button>
      </div>

      <div className="pc-menu-group">
        <span className="pc-menu-label">{tr("pcMenuMesh")}</span>
        <button
          type="button"
          className="pc-menu-btn pc-menu-btn-accent"
          disabled={disabled}
          onClick={() => void run(() => editorCreateMesh(sessionId!))}
        >
          {tr("pcMenuCreateMesh")}
        </button>
        {properties?.mesh && (
          <span className="pc-menu-hint">
            {properties.mesh.vertices.toLocaleString()} v · {properties.mesh.triangles.toLocaleString()} tri
          </span>
        )}
      </div>

      {busy && <span className="pc-menu-busy">{tr("pcMenuWorking")}</span>}
    </nav>
  );
}
