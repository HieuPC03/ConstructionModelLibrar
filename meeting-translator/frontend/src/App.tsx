import { useEffect, useState } from "react";
import ConversationPanel from "./components/ConversationPanel";
import SettingsBar from "./components/SettingsBar";
import TextTranslatePanel from "./components/TextTranslatePanel";
import { SessionModeProvider } from "./SessionModeContext";
import { checkHealth } from "./api";

export default function App() {
  const [provider, setProvider] = useState("…");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [configWarning, setConfigWarning] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then((h) => {
        setProvider(h.provider || "Google Translate");
        setBackendOk(true);
        if (h.api_key_ok === false && h.message) {
          setConfigWarning(h.message);
        } else {
          setConfigWarning(null);
        }
      })
      .catch(() => setBackendOk(false));
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>Meeting Translator</h1>
        <span className="badge">
          {window.desktopApp?.isDesktop
            ? "Desktop app"
            : backendOk === false
              ? "Backend offline"
              : backendOk
                ? `API · ${provider}`
                : "Đang kết nối…"}
        </span>
      </header>
      <SessionModeProvider>
        <SettingsBar />
        {configWarning && (
          <div
            className="status-bar error"
            style={{ borderTop: "none", borderBottom: "1px solid var(--border)" }}
          >
            {configWarning}
          </div>
        )}
        <main className="split-layout">
          <ConversationPanel />
          <TextTranslatePanel />
        </main>
      </SessionModeProvider>
    </>
  );
}
