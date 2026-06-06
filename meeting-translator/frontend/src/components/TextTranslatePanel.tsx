import { useEffect, useState } from "react";
import type { LangCode } from "../types";
import {
  APP_RESET_EVENT,
  TEXT_TRANSLATE_FILL_EVENT,
  type TextTranslateFillDetail,
  type TextTranslateProvider,
  translateText,
} from "../api";
import { useAppSettings } from "../AppSettingsContext";
import { copyText } from "../utils/clipboard";

const TEXT_PROVIDER_KEY = "meeting-translator-text-provider";

function loadTextProvider(): TextTranslateProvider {
  try {
    const v = localStorage.getItem(TEXT_PROVIDER_KEY);
    if (v === "openai" || v === "google") return v;
    if (v === "grok") return "openai";
  } catch {
    /* ignore */
  }
  return "google";
}

export default function TextTranslatePanel() {
  const { tr } = useAppSettings();
  const [sourceLang, setSourceLang] = useState<LangCode>("vi");
  const [targetLang, setTargetLang] = useState<LangCode>("ja");
  const [provider, setProvider] = useState<TextTranslateProvider>(loadTextProvider);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [lastProviderLabel, setLastProviderLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TEXT_PROVIDER_KEY, provider);
    } catch {
      /* ignore */
    }
  }, [provider]);

  useEffect(() => {
    const onReset = () => {
      setSourceLang("vi");
      setTargetLang("ja");
      setInput("");
      setOutput("");
      setError(null);
      setLastProviderLabel(null);
    };
    window.addEventListener(APP_RESET_EVENT, onReset);
    return () => window.removeEventListener(APP_RESET_EVENT, onReset);
  }, []);

  useEffect(() => {
    const onFill = (ev: Event) => {
      const detail = (ev as CustomEvent<TextTranslateFillDetail>).detail;
      if (!detail?.text) return;
      setInput(detail.text);
      setOutput("");
      setError(null);
      setLastProviderLabel(null);
      if (detail.sourceLang && detail.sourceLang !== "auto") {
        setSourceLang(detail.sourceLang);
      }
      if (detail.targetLang) {
        setTargetLang(detail.targetLang);
      }
      setCopyMsg(tr("filledFromCaption"));
      setTimeout(() => setCopyMsg(null), 2500);
    };
    window.addEventListener(TEXT_TRANSLATE_FILL_EVENT, onFill);
    return () => window.removeEventListener(TEXT_TRANSLATE_FILL_EVENT, onFill);
  }, [tr]);

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
      const result = await translateText(
        input,
        sourceLang,
        targetLang,
        provider
      );
      setOutput(result.translation);
      setLastProviderLabel(result.provider);
      if (result.notice) {
        setError(result.notice);
      }
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
      setLastProviderLabel(null);
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

  const providerBadge =
    provider === "openai" ? tr("chatGptTranslate") : tr("googleTranslate");

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{tr("textTranslate")}</h2>
        <span className="badge">
          {lastProviderLabel || providerBadge}
        </span>
      </div>

      <div className="mode-switch text-provider-switch">
        <button
          type="button"
          className={
            provider === "google" ? "mode-btn active" : "mode-btn secondary"
          }
          onClick={() => setProvider("google")}
          disabled={loading}
        >
          {tr("textProviderGoogle")}
        </button>
        <button
          type="button"
          className={
            provider === "openai" ? "mode-btn active" : "mode-btn secondary"
          }
          onClick={() => setProvider("openai")}
          disabled={loading}
        >
          {tr("textProviderChatGpt")}
        </button>
      </div>

      <div className="hint-box">
        {provider === "openai" ? tr("textHintChatGpt") : tr("textHintGoogle")}
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
          {error && !output ? (
            <span style={{ color: "var(--danger)" }}>{error}</span>
          ) : output ? (
            output
          ) : (
            <span style={{ color: "var(--muted)" }}>{tr("resultPlaceholder")}</span>
          )}
        </div>
        {error && output && (
          <p className="translate-notice" style={{ color: "var(--muted)", marginTop: "0.35rem" }}>
            {error}
          </p>
        )}
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
