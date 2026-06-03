import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APP_RESET_EVENT,
  fetchSettings,
  resetSettings,
  updateSettings,
  type SessionMode,
} from "./api";

type SessionModeContextValue = {
  sessionMode: SessionMode;
  setSessionMode: (mode: SessionMode) => void;
  resetToDefaults: () => Promise<void>;
};

const SessionModeContext = createContext<SessionModeContextValue | null>(null);

export function SessionModeProvider({ children }: { children: ReactNode }) {
  const [sessionMode, setSessionModeState] = useState<SessionMode>("transcript");

  useEffect(() => {
    fetchSettings()
      .then((s) => setSessionModeState(s.session_mode || "transcript"))
      .catch(() => undefined);
  }, []);

  const setSessionMode = useCallback((mode: SessionMode) => {
    setSessionModeState(mode);
    updateSettings({ session_mode: mode }).catch(() => undefined);
  }, []);

  const resetToDefaults = useCallback(async () => {
    const saved = await resetSettings();
    setSessionModeState(saved.session_mode || "transcript");
    window.dispatchEvent(new Event(APP_RESET_EVENT));
  }, []);

  const value = useMemo(
    () => ({ sessionMode, setSessionMode, resetToDefaults }),
    [sessionMode, setSessionMode, resetToDefaults]
  );

  return (
    <SessionModeContext.Provider value={value}>
      {children}
    </SessionModeContext.Provider>
  );
}

export function useSessionMode(): SessionModeContextValue {
  const ctx = useContext(SessionModeContext);
  if (!ctx) {
    throw new Error("useSessionMode must be used within SessionModeProvider");
  }
  return ctx;
}
