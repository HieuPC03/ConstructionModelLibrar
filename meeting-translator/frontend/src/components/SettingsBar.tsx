import { useEffect, useState } from "react";
import { testApiKey, updateSettings } from "../api";
import { useAppSettings, type ThemeId } from "../AppSettingsContext";
import { useSessionMode } from "../SessionModeContext";

export default function SettingsBar() {
  const {
    tr,
    lang,
    setLang,
    theme,
    setTheme,
    exportDir,
    setExportDir,
    saveSettings,
    settings,
  } = useAppSettings();
  const { sessionMode, setSessionMode } = useSessionMode();
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSessionMode(settings?.session_mode || "transcript");
  }, [settings?.session_mode, setSessionMode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        session_mode: sessionMode,
        export_dir: exportDir,
        recordings_dir: exportDir,
        ui_language: lang,
        theme,
      });
      await saveSettings();
      setTestMsg(tr("saved"));
    } catch (e) {
      setTestMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pickFolder = async () => {
    const dir = await window.desktopApp?.pickFolder?.();
    if (dir) setExportDir(dir);
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
        </select>
      </label>
      <label className="settings-field settings-path">
        {tr("exportFolder")}
        <input
          type="text"
          value={exportDir}
          onChange={(e) => setExportDir(e.target.value)}
          placeholder={settings?.recordings_dir_active ?? "AppData"}
        />
        {window.desktopApp?.pickFolder && (
          <button type="button" className="secondary" onClick={() => void pickFolder()}>
            {tr("pick")}
          </button>
        )}
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
  );
}
