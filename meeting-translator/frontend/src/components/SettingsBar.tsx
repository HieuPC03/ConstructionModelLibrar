import { useEffect, useState } from "react";
import {
  fetchSettings,
  testApiKey,
  updateSettings,
  type AppSettings,
  type TranslatorProvider,
} from "../api";

export default function SettingsBar() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recordingsDir, setRecordingsDir] = useState("");
  const [exportDir, setExportDir] = useState("");
  const [uiLang, setUiLang] = useState<"vi" | "ja">("vi");
  const [provider, setProvider] = useState<TranslatorProvider>("google");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setRecordingsDir(s.recordings_dir || "");
        setExportDir(s.export_dir || "");
        setUiLang(s.ui_language || "vi");
        setProvider(
          (s.translator_provider as TranslatorProvider) || "google"
        );
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const s = await updateSettings({
        recordings_dir: recordingsDir,
        export_dir: exportDir,
        ui_language: uiLang,
        translator_provider: provider,
      });
      setSettings(s);
      setTestMsg("Đã lưu nhà cung cấp và đường dẫn.");
    } catch (e) {
      setTestMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pickFolder = async (target: "recordings" | "export") => {
    const dir = await window.desktopApp?.pickFolder?.();
    if (!dir) return;
    if (target === "recordings") setRecordingsDir(dir);
    else setExportDir(dir);
  };

  const openConfig = () => {
    window.desktopApp?.openConfigFolder?.();
  };

  const runTest = async () => {
    setTestMsg("Đang kiểm tra…");
    try {
      const msg = await testApiKey();
      setTestMsg(msg);
    } catch (e) {
      setTestMsg((e as Error).message);
    }
  };

  return (
    <div className="settings-bar">
      <span className="settings-title">
        {uiLang === "ja" ? "設定" : "Cài đặt"}
      </span>
      <label className="settings-field">
        {uiLang === "ja" ? "翻訳API" : "Nhà cung cấp"}
        <select
          value={provider}
          onChange={(e) =>
            setProvider(e.target.value as TranslatorProvider)
          }
          title="OpenAI hết quota → chọn Google Translate hoặc Gemini"
        >
          <option value="gemini">Google Gemini — ghi chữ + STT (khuyến nghị)</option>
          <option value="google">Google (chỉ hỗ trợ hạn chế)</option>
          <option value="openai">OpenAI (cần billing)</option>
        </select>
      </label>
      <label className="settings-field">
        {uiLang === "ja" ? "言語" : "Ngôn ngữ app"}
        <select
          value={uiLang}
          onChange={(e) => setUiLang(e.target.value as "vi" | "ja")}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="ja">日本語</option>
        </select>
      </label>
      <label className="settings-field settings-path">
        {uiLang === "ja" ? "録音保存" : "Lưu hội thoại"}
        <input
          type="text"
          value={recordingsDir}
          onChange={(e) => setRecordingsDir(e.target.value)}
          placeholder={settings?.recordings_dir_active ?? "Mặc định AppData"}
        />
        {window.desktopApp?.pickFolder && (
          <button
            type="button"
            className="secondary"
            onClick={() => pickFolder("recordings")}
          >
            Chọn…
          </button>
        )}
      </label>
      <label className="settings-field settings-path">
        {uiLang === "ja" ? "テキスト保存" : "Lưu văn bản"}
        <input
          type="text"
          value={exportDir}
          onChange={(e) => setExportDir(e.target.value)}
          placeholder="Thư mục xuất file .txt"
        />
        {window.desktopApp?.pickFolder && (
          <button
            type="button"
            className="secondary"
            onClick={() => pickFolder("export")}
          >
            Chọn…
          </button>
        )}
      </label>
      <button type="button" className="secondary" onClick={save} disabled={saving}>
        {saving ? "…" : "Lưu"}
      </button>
      <button type="button" className="secondary" onClick={runTest}>
        Test API
      </button>
      {window.desktopApp?.openConfigFolder && (
        <button type="button" className="secondary" onClick={openConfig}>
          Mở .env
        </button>
      )}
      {testMsg && (
        <span
          className={`settings-msg ${testMsg.includes("thất") || testMsg.includes("không") || testMsg.includes("Lỗi") || testMsg.includes("quota") || testMsg.includes("Thiếu") ? "err" : ""}`}
        >
          {testMsg}
        </span>
      )}
    </div>
  );
}
