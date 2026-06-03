import { useEffect, useState } from "react";
import ConversationPanel from "./components/ConversationPanel";
import TextTranslatePanel from "./components/TextTranslatePanel";
import { checkHealth } from "./api";

export default function App() {
  const [provider, setProvider] = useState("…");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth()
      .then((h) => {
        setProvider(h.provider);
        setBackendOk(true);
      })
      .catch(() => setBackendOk(false));
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>Meeting Translator — Dịch họp realtime</h1>
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
      <main className="split-layout">
        <ConversationPanel provider={provider} />
        <TextTranslatePanel provider={provider} />
      </main>
    </>
  );
}
