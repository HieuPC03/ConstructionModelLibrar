import { useEffect, useState } from "react";
import type { LangCode } from "../types";
import { APP_RESET_EVENT, translateText } from "../api";
import { useAppSettings } from "../AppSettingsContext";
import { copyText } from "../utils/clipboard";

export default function TextTranslatePanel() {
  const { tr } = useAppSettings();
  const [sourceLang, setSourceLang] = useState<LangCode>("vi");
  const [targetLang, setTargetLang] = useState<LangCode>("ja");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    const onReset = () => {
      setSourceLang("vi");
      setTargetLang("ja");
      setInput("");
      setOutput("");
      setError(null);
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
    try {
      const result = await translateText(input, sourceLang, targetLang);
      setOutput(result.translation);
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    await copyText(text);
    setCopyMsg(tr("copied"));
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text);
      setCopyMsg(tr("pasted"));
      setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setError("Không đọc được clipboard. Cho phép quyền dán hoặc dán thủ công (Ctrl+V).");
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{tr("textTranslate")}</h2>
        <span className="badge">{tr("googleTranslate")}</span>
      </div>

      <div className="hint-box">{tr("textHint")}</div>

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
            {tr("viToJa")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSourceLang("ja");
              setTargetLang("vi");
            }}
          >
            {tr("jaToVi")}
          </button>
          <label>
            {tr("from")}
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as LangCode)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={swap} title="⇄">
            ⇄
          </button>
          <label>
            {tr("to")}
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as LangCode)}
            >
              <option value="ja">日本語</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
          <button onClick={() => void handleTranslate()} disabled={loading || !input.trim()}>
            {loading ? tr("translating") : tr("translate")}
          </button>
        </div>

        <textarea
          placeholder={tr("inputPlaceholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
        />
        <div className="text-actions-row">
          <button type="button" className="secondary" onClick={() => void handlePaste()}>
            {tr("paste")}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!input.trim()}
            onClick={() => void handleCopy(input)}
          >
            {tr("copy")} ({tr("from")})
          </button>
        </div>

        <div className="translation-result">
          {error ? (
            <span style={{ color: "var(--danger)" }}>{error}</span>
          ) : output ? (
            output
          ) : (
            <span style={{ color: "var(--muted)" }}>{tr("resultPlaceholder")}</span>
          )}
        </div>
        {output && (
          <button
            type="button"
            className="secondary"
            style={{ marginTop: "0.5rem" }}
            onClick={() => void handleCopy(output)}
          >
            {tr("copy")} ({tr("to")})
          </button>
        )}
        {copyMsg && (
          <span className="copy-toast" style={{ color: "var(--success)" }}>
            {copyMsg}
          </span>
        )}
      </div>
    </section>
  );
}
