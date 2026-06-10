import { useEffect, useState } from "react";
import jastyLogo from "./assets/jasty-logo.png";
import ConversationPanel from "./components/ConversationPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import SettingsBar from "./components/SettingsBar";
import TextTranslatePanel from "./components/TextTranslatePanel";
import { AppSettingsProvider, useAppSettings } from "./AppSettingsContext";
import { ExportProvider } from "./ExportContext";
import { SessionModeProvider } from "./SessionModeContext";
import { checkHealth } from "./api";

function AppInner() {
  const { tr, theme } = useAppSettings();
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
    <div className="app-shell">
      <div className="app-bg-watermark" aria-hidden="true">
        <img src={jastyLogo} alt="" className="app-bg-logo" draggable={false} />
      </div>
      <div className="app-top-chrome">
        <header className="app-header">
          <div className="app-header-brand">
            {theme === "jasty" ? (
              <img
                src={jastyLogo}
                alt="JASTY"
                className="app-header-logo"
                draggable={false}
              />
            ) : (
              <span className="brand-accent" aria-hidden />
            )}
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
      </div>
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
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppSettingsProvider>
        <SessionModeProvider>
          <ExportProvider>
            <AppInner />
          </ExportProvider>
        </SessionModeProvider>
      </AppSettingsProvider>
    </ErrorBoundary>
  );
}
