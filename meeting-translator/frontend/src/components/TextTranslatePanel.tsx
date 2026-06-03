import { useEffect, useState } from "react";
import type { LangCode } from "../types";
import { APP_RESET_EVENT, translateText } from "../api";
import { useSessionMode } from "../SessionModeContext";

export default function TextTranslatePanel() {
  const { sessionMode } = useSessionMode();
  const [sourceLang, setSourceLang] = useState<LangCode>("vi");
  const [targetLang, setTargetLang] = useState<LangCode>("ja");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const apiLabel =
    activeProvider ??
    (sessionMode === "translate_realtime" ? "ChatGPT" : "Gemini");

  useEffect(() => {
    const onReset = () => {
      setSourceLang("vi");
      setTargetLang("ja");
      setInput("");
      setOutput("");
      setError(null);
      setNotice(null);
      setActiveProvider(null);
    };
    window.addEventListener(APP_RESET_EVENT, onReset);
    return () => window.removeEventListener(APP_RESET_EVENT, onReset);
  }, []);

  const swap = () => {
    setSourceLang(targetLang === "auto" ? "vi" : targetLang);
    setTargetLang(sourceLang === "auto" ? "ja" : sourceLang);
    setInput(output);
    setOutput("");
  };

  const handleTranslate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await translateText(
        input,
        sourceLang,
        targetLang,
        sessionMode
      );
      setOutput(result.translation);
      setActiveProvider(result.provider);
      setNotice(result.notice);
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
      setNotice(null);
      setActiveProvider(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Dịch văn bản</h2>
        <span className="badge">{apiLabel}</span>
      </div>

      <div className="hint-box">
        Dịch thủ công qua{" "}
        <strong>{sessionMode === "translate_realtime" ? "ChatGPT" : "Gemini"}</strong>{" "}
        (theo chế độ phiên bên trái). Nếu Gemini hết quota, app tự chuyển sang{" "}
        <strong>Google Translate</strong> và hiện thông báo.
      </div>

      <div className="text-translate-body">
        <div className="lang-swap">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSourceLang("vi");
              setTargetLang("ja");
            }}
          >
            Việt → Nhật
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSourceLang("ja");
              setTargetLang("vi");
            }}
          >
            Nhật → Việt
          </button>
          <label>
            Từ
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as LangCode)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={swap} title="Đổi chiều">
            ⇄
          </button>
          <label>
            Sang
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as LangCode)}
            >
              <option value="ja">日本語</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
          <button onClick={handleTranslate} disabled={loading || !input.trim()}>
            {loading ? "Đang dịch…" : "Dịch"}
          </button>
        </div>

        <textarea
          placeholder="Nhập văn bản…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
        />

        {notice && (
          <div
            className="hint-box"
            style={{
              marginBottom: "0.5rem",
              borderColor: "var(--accent)",
              color: "var(--accent)",
            }}
            role="status"
          >
            {notice}
          </div>
        )}

        <div className="translation-result">
          {error ? (
            <span style={{ color: "var(--danger)" }}>{error}</span>
          ) : output ? (
            output
          ) : (
            <span style={{ color: "var(--muted)" }}>
              Kết quả dịch ({apiLabel})…
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
