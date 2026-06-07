import { useI18n } from "../../i18n/I18nProvider";
import type { ViewDirection } from "../ViewCube";

export interface CameraBridge {
  getCamera: () => { position: [number, number, number]; target: [number, number, number] } | null;
  setCamera: (position: [number, number, number], target: [number, number, number]) => void;
  applyViewPreset?: (dir: ViewDirection) => void;
}

interface PointCloudViewBarProps {
  cameraBridgeRef: React.MutableRefObject<CameraBridge | null>;
}

export function PointCloudViewBar({ cameraBridgeRef }: PointCloudViewBarProps) {
  const { tr } = useI18n();

  const apply = (dir: ViewDirection) => {
    cameraBridgeRef.current?.applyViewPreset?.(dir);
  };

  return (
    <div className="tp-view-bar">
      <span className="tp-view-bar-label">{tr("viewBarProjection")}</span>
      <div className="tp-view-bar-group">
        <button type="button" className="tp-view-btn" title={tr("viewBarTop")} onClick={() => apply("top")}>
          {tr("viewBarTop")}
        </button>
        <button type="button" className="tp-view-btn" title={tr("viewBarFront")} onClick={() => apply("front")}>
          {tr("viewBarFront")}
        </button>
        <button
          type="button"
          className="tp-view-btn tp-view-btn-home"
          title={tr("viewBarHome")}
          onClick={() => apply("front-right")}
        >
          {tr("viewBarHome")}
        </button>
      </div>
    </div>
  );
}
