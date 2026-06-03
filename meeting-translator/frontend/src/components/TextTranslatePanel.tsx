import { useEffect, useState } from "react";
import type { LangCode } from "../types";
import { fetchSettings, translateText, type SessionMode } from "../api";

export default function TextTranslatePanel() {
  const [sessionMode, setSessionMode] = useState<SessionMode>("transcript");
  const [sourceLang, setSourceLang] = useState<LangCode>("vi");
  const [targetLang, setTargetLang] = useState<LangCode>("ja");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then((s) => setSessionMode(s.session_mode || "transcript"))
      .catch(() => undefined);
  }, []);

  const apiLabel =
    sessionMode === "translate_realtime" ? "ChatGPT" : "Gemini";

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
    try {
      const result = await translateText(input, sourceLang, targetLang);
      setOutput(result);
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
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
        (theo chế độ phiên bên trái).
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
