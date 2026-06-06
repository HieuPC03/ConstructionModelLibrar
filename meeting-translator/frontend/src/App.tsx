import { useEffect, useState } from "react";
import ConversationPanel from "./components/ConversationPanel";
import SettingsBar from "./components/SettingsBar";
import TextTranslatePanel from "./components/TextTranslatePanel";
import { AppSettingsProvider, useAppSettings } from "./AppSettingsContext";
import { SessionModeProvider } from "./SessionModeContext";
import { checkHealth } from "./api";

function AppInner() {
  const { tr } = useAppSettings();
  const [provider, setProvider] = useState("…");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [configWarning, setConfigWarning] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then((h) => {
        setProvider(h.provider || "Google Translate");
        setBackendOk(true);
        setConfigWarning(h.api_key_ok === false && h.message ? h.message : null);
      })
      .catch(() => setBackendOk(false));
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="app-header-brand">
          <span className="brand-accent" aria-hidden />
          <h1>{tr("appTitle")}</h1>
        </div>
        <span className="badge header-status">
          {window.desktopApp?.isDesktop
            ? tr("desktop")
            : backendOk === false
              ? tr("offline")
              : backendOk
                ? `API · ${provider}`
                : tr("connecting")}
        </span>
      </header>
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
    </>
  );
}

export default function App() {
  return (
    <AppSettingsProvider>
      <SessionModeProvider>
        <AppInner />
      </SessionModeProvider>
    </AppSettingsProvider>
  );
}
