import { useEffect, useState } from "react";
import { testApiKey, updateSettings } from "../api";
import { useAppSettings, type ThemeId } from "../AppSettingsContext";
import { useExport } from "../ExportContext";
import { useSessionMode } from "../SessionModeContext";

export default function SettingsBar() {
  const { tr, lang, setLang, theme, setTheme, saveSettings, settings } =
    useAppSettings();
  const { sessionMode, setSessionMode } = useSessionMode();
  const { canExport, openExportModal } = useExport();
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sttModel, setSttModel] = useState("gpt-4o-mini-transcribe");
  const [accuracyMode, setAccuracyMode] = useState("high");

  useEffect(() => {
    setSessionMode(settings?.session_mode || "transcript");
    setSttModel(settings?.stt_model || "gpt-4o-mini-transcribe");
    setAccuracyMode(settings?.accuracy_mode || "high");
  }, [settings?.session_mode, settings?.stt_model, settings?.accuracy_mode, setSessionMode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        session_mode: sessionMode,
        ui_language: lang,
        theme,
        stt_model: sttModel,
        accuracy_mode: accuracyMode,
      });
      await saveSettings();
      setTestMsg(tr("saved"));
    } catch (e) {
      setTestMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTestMsg("…");
    try {
      setTestMsg(await testApiKey());
    } catch (e) {
      setTestMsg((e as Error).message);
    }
  };

  return (
    <div className="settings-bar">
      <div className="settings-row">
        <span className="settings-title">{tr("settings")}</span>
        <label className="settings-field">
          {tr("defaultMode")}
          <select
            value={sessionMode}
            onChange={(e) =>
              setSessionMode(
                e.target.value as "translate_realtime" | "transcript"
              )
            }
          >
            <option value="transcript">{tr("modeTranscript")}</option>
            <option value="translate_realtime">{tr("modeRealtime")}</option>
          </select>
        </label>
        <label className="settings-field">
          {tr("uiLang")}
          <select value={lang} onChange={(e) => setLang(e.target.value as "vi" | "ja")}>
            <option value="vi">Tiếng Việt</option>
            <option value="ja">日本語</option>
          </select>
        </label>
        <label className="settings-field">
          {tr("theme")}
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)}>
            <option value="dark">{tr("themeDark")}</option>
            <option value="light">{tr("themeLight")}</option>
            <option value="ocean">{tr("themeOcean")}</option>
            <option value="jasty">{tr("themeJasty")}</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary settings-export-btn"
          disabled={!canExport}
          onClick={openExportModal}
        >
          {tr("exportData")}
        </button>
      </div>
      <div className="settings-row">
        <label className="settings-field">
          {tr("sttModel")}
          <select value={sttModel} onChange={(e) => setSttModel(e.target.value)}>
            <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</option>
            <option value="gpt-4o-transcribe">gpt-4o-transcribe</option>
            <option value="whisper-1">whisper-1</option>
          </select>
        </label>
        <label className="settings-field">
          {tr("accuracyMode")}
          <select value={accuracyMode} onChange={(e) => setAccuracyMode(e.target.value)}>
            <option value="high">{tr("accuracyHigh")}</option>
            <option value="balanced">{tr("accuracyBalanced")}</option>
            <option value="fast">{tr("accuracyFast")}</option>
          </select>
        </label>
        <button type="button" className="secondary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "…" : tr("save")}
        </button>
        <button type="button" className="secondary" onClick={() => void runTest()}>
          {tr("testApi")}
        </button>
        {window.desktopApp?.openConfigFolder && (
          <button type="button" className="secondary" onClick={() => window.desktopApp?.openConfigFolder?.()}>
            {tr("openEnv")}
          </button>
        )}
        {testMsg && <span className="settings-msg">{testMsg}</span>}
      </div>
    </div>
  );
}
