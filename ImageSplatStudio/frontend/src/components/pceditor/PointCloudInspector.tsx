import { useI18n } from "../../i18n/I18nProvider";
import { formatWorldCoords, viewerToWorld, type NormMeta } from "../../utils/coordTransform";

export interface InspectedPoint {
  viewer: [number, number, number];
  world?: [number, number, number];
  index?: number;
  rgb?: [number, number, number];
}

interface PointCloudInspectorProps {
  point: InspectedPoint | null;
  normMeta?: NormMeta;
  swapXy?: boolean;
  totalPoints?: number | null;
}

export function PointCloudInspector({ point, normMeta, swapXy, totalPoints }: PointCloudInspectorProps) {
  const { tr } = useI18n();

  const world =
    point && normMeta
      ? viewerToWorld(point.viewer, normMeta, !!swapXy)
      : point?.world;

  return (
    <div className="pc-inspector">
      <h3 className="pc-panel-title">{tr("inspectorTitle")}</h3>
      {totalPoints != null && (
        <p className="pc-inspector-meta">
          {tr("inspectorTotalPoints")}: <strong>{totalPoints.toLocaleString()}</strong>
        </p>
      )}
      {!point ? (
        <p className="pc-inspector-empty">{tr("inspectorEmpty")}</p>
      ) : (
        <dl className="pc-inspector-dl">
          <dt>{tr("inspectorViewer")}</dt>
          <dd>{point.viewer.map((v) => v.toFixed(4)).join(", ")}</dd>
          {world && (
            <>
              <dt>{tr("statusWorldCoords")}</dt>
              <dd>{formatWorldCoords(world)}</dd>
            </>
          )}
          {point.index != null && (
            <>
              <dt>{tr("inspectorIndex")}</dt>
              <dd>{point.index}</dd>
            </>
          )}
          {point.rgb && (
            <>
              <dt>RGB</dt>
              <dd>
                <span
                  className="pc-inspector-swatch"
                  style={{
                    background: `rgb(${point.rgb[0]},${point.rgb[1]},${point.rgb[2]})`,
                  }}
                />
                {point.rgb.join(", ")}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
