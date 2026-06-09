import { useI18n } from "../../i18n/I18nProvider";
import { editorDeleteViewpoint, editorExportViewerUrl, type EditorProperties } from "../../api/editor";
import { triggerDownload } from "../../utils/export";

interface ViewpointPanelProps {
  sessionId: string | null;
  properties: EditorProperties | null;
  onApplyView: (camera: number[], target: number[]) => void;
  onSaveView: () => void;
  onUpdated: (props: EditorProperties) => void;
}

export function ViewpointPanel({
  sessionId,
  properties,
  onApplyView,
  onSaveView,
  onUpdated,
}: ViewpointPanelProps) {
  const { tr } = useI18n();
  const views = properties?.viewpoints ?? [];

  return (
    <div className="pc-viewpoint-panel">
      <div className="pc-viewpoint-head">
        <strong>{tr("viewpointTitle")}</strong>
        <button type="button" className="pc-process-btn" disabled={!sessionId} onClick={onSaveView}>
          {tr("viewpointSave")}
        </button>
        <button
          type="button"
          className="pc-process-btn"
          disabled={!sessionId}
          onClick={() => {
            if (sessionId) triggerDownload(editorExportViewerUrl(sessionId), "viewer_package.json");
          }}
        >
          {tr("viewpointExport")}
        </button>
      </div>
      {views.length === 0 ? (
        <p className="pc-cross-empty">{tr("viewpointEmpty")}</p>
      ) : (
        <ul className="pc-viewpoint-list">
          {views.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => onApplyView(v.camera, v.target)}>
                {v.name}
              </button>
              <button
                type="button"
                className="pc-viewpoint-del"
                onClick={() => {
                  if (!sessionId) return;
                  void editorDeleteViewpoint(sessionId, v.id).then(onUpdated);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
