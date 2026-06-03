import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchSettings, updateSettings, type SessionMode } from "./api";

type SessionModeContextValue = {
  sessionMode: SessionMode;
  setSessionMode: (mode: SessionMode) => void;
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

  const value = useMemo(
    () => ({ sessionMode, setSessionMode }),
    [sessionMode, setSessionMode]
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
