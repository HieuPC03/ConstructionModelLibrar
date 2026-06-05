import { useI18n } from "../../i18n/I18nProvider";
import { editorSetClassVisibility } from "../../api/editor";
import type { EditorProperties } from "../../api/editor";
import {
  ASPRS_CLASS_COLORS,
  EDITABLE_CLASS_IDS,
  className,
} from "../../utils/classificationColors";

import type { EditorTool } from "../../utils/editorTools";

interface ClassificationPanelProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  activeClassId: number;
  onActiveClassChange: (id: number) => void;
  activeTool?: EditorTool;
  lassoAction?: "classify" | "delete" | "hide";
  onLassoActionChange?: (action: "classify" | "delete" | "hide") => void;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
}

export function ClassificationPanel({
  sessionId,
  properties,
  activeClassId,
  onActiveClassChange,
  activeTool,
  lassoAction = "classify",
  onLassoActionChange,
  onUpdated,
  onRefreshPreview,
  onError,
}: ClassificationPanelProps) {
  const { locale, tr } = useI18n();
  const layers = properties?.classifications?.layers ?? [];

  const toggleLayer = async (classId: number, visible: boolean) => {
    if (!sessionId) return;
    try {
      const props = await editorSetClassVisibility(sessionId, classId, visible);
      onUpdated(props);
      onRefreshPreview();
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  return (
    <div className="pc-class-panel">
      <h4>{tr("classPanelTitle")}</h4>
      <p className="tp-muted pc-class-hint">{tr("classPanelHint")}</p>
      {activeTool === "lasso_select" && onLassoActionChange && (
        <label className="pc-class-lasso-action">
          {tr("lassoActionLabel")}
          <select
            className="tp-select"
            value={lassoAction}
            onChange={(e) => onLassoActionChange(e.target.value as "classify" | "delete" | "hide")}
          >
            <option value="classify">{tr("lassoActionClassify")}</option>
            <option value="delete">{tr("lassoActionDelete")}</option>
            <option value="hide">{tr("lassoActionHide")}</option>
          </select>
        </label>
      )}
      <div className="pc-class-palette">
        {EDITABLE_CLASS_IDS.map((id) => {
          const rgb = ASPRS_CLASS_COLORS[id] ?? [0.5, 0.5, 0.5];
          return (
            <button
              key={id}
              type="button"
              className={`pc-class-swatch ${activeClassId === id ? "active" : ""}`}
              title={className(id, locale)}
              onClick={() => onActiveClassChange(id)}
            >
              <span
                className="pc-class-color"
                style={{
                  background: `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`,
                }}
              />
              <span className="pc-class-label">{className(id, locale)}</span>
            </button>
          );
        })}
      </div>
      {layers.length > 0 && (
        <>
          <h4>{tr("classLayersTitle")}</h4>
          <ul className="pc-class-layers">
            {layers.map((layer) => {
              const rgb = ASPRS_CLASS_COLORS[layer.id] ?? [0.5, 0.5, 0.5];
              return (
                <li key={layer.id} className="pc-class-layer">
                  <label>
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={(e) => void toggleLayer(layer.id, e.target.checked)}
                    />
                    <span
                      className="pc-class-dot"
                      style={{
                        background: `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`,
                      }}
                    />
                    {className(layer.id, locale)} ({layer.count.toLocaleString()})
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
