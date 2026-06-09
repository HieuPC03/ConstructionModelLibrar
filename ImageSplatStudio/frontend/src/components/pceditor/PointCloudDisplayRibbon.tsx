import { useI18n } from "../../i18n/I18nProvider";
import { editorConfigureView, type EditorProperties } from "../../api/editor";
import { COLOR_MODES, colorModeLabelKey, type ColorMode } from "../../utils/colorModes";
import { logConsole } from "../../utils/consoleLog";

interface PointCloudDisplayRibbonProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  onUpdated: (props: EditorProperties) => void;
  onRefreshPreview: () => void;
  onError: (msg: string) => void;
}

export function PointCloudDisplayRibbon({
  sessionId,
  properties,
  onUpdated,
  onRefreshPreview,
  onError,
}: PointCloudDisplayRibbonProps) {
  const { tr } = useI18n();
  const disabled = !sessionId || !properties;

  const apply = async (opts: Parameters<typeof editorConfigureView>[1]) => {
    if (!sessionId) return;
    try {
      const props = await editorConfigureView(sessionId, opts);
      onUpdated(props);
      onRefreshPreview();
      logConsole(tr("displayApplied"), "info");
    } catch (e: unknown) {
      onError(String(e));
    }
  };

  const colorMode = (properties?.view?.color_mode ?? "rgb") as ColorMode;

  return (
    <div className="pc-process-ribbon pc-display-ribbon">
      <div className="pc-process-row">
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("displayGroupColor")}</span>
          <select
            className="pc-ribbon-select"
            disabled={disabled}
            value={colorMode}
            onChange={(e) => void apply({ color_mode: e.target.value })}
          >
            {COLOR_MODES.map((m) => (
              <option key={m} value={m}>
                {tr(colorModeLabelKey(m) as import("../../i18n/translations").TranslationKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("displayGroupView")}</span>
          <label className="pc-process-inline pc-file-option">
            <input
              type="checkbox"
              disabled={disabled}
              checked={properties?.view?.show_axes ?? false}
              onChange={(e) => void apply({ show_axes: e.target.checked })}
            />
            {tr("pcAxesEnable")}
          </label>
        </div>
        <div className="pc-process-group">
          <span className="pc-ribbon-label">{tr("displayGroupCrs")}</span>
          <p className="pc-process-hint">
            {properties?.crs?.name ?? "—"} · {tr("pcMenuSwapXy")}{" "}
            {properties?.swap_xy ? "ON" : "OFF"}
          </p>
          <p className="pc-process-hint">{tr("pcTextureMappingHint")}</p>
        </div>
      </div>
    </div>
  );
}
