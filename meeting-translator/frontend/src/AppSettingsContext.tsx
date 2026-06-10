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
  updateSettings,
  type AppSettings,
} from "./api";
import { t, type UiLang } from "./i18n/messages";

export type ThemeId = "dark" | "light" | "ocean" | "jasty";

const THEME_IDS: ThemeId[] = ["dark", "light", "ocean", "jasty"];

function normalizeTheme(value: string | undefined): ThemeId {
  if (value && THEME_IDS.includes(value as ThemeId)) {
    return value as ThemeId;
  }
  return "dark";
}

type AppSettingsContextValue = {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  exportDir: string;
  recordingsDir: string;
  setExportDir: (d: string) => void;
  setRecordingsDir: (d: string) => void;
  saveSettings: () => Promise<void>;
  tr: (key: Parameters<typeof t>[1]) => string;
  settings: AppSettings | null;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("vi");
  const [theme, setThemeState] = useState<ThemeId>("dark");
  const [exportDir, setExportDir] = useState("");
  const [recordingsDir, setRecordingsDir] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const applyTheme = useCallback((id: ThemeId) => {
    document.documentElement.setAttribute("data-theme", id);
  }, []);

  const load = useCallback(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setLangState(s.ui_language || "vi");
        setThemeState(normalizeTheme(s.theme));
        setExportDir(s.export_dir || "");
        setRecordingsDir(s.recordings_dir || "");
        applyTheme(normalizeTheme(s.theme));
      })
      .catch(() => undefined);
  }, [applyTheme]);

  useEffect(() => {
    load();
    const onReset = () => load();
    window.addEventListener(APP_RESET_EVENT, onReset);
    return () => window.removeEventListener(APP_RESET_EVENT, onReset);
  }, [load]);

  const setLang = useCallback((l: UiLang) => {
    setLangState(l);
    updateSettings({ ui_language: l }).catch(() => undefined);
  }, []);

  const setTheme = useCallback(
    (id: ThemeId) => {
      setThemeState(id);
      applyTheme(id);
      updateSettings({ theme: id }).catch(() => undefined);
    },
    [applyTheme]
  );

  const saveSettings = useCallback(async () => {
    const s = await updateSettings({
      export_dir: exportDir,
      recordings_dir: recordingsDir,
      ui_language: lang,
      theme,
    });
    setSettings(s);
  }, [exportDir, recordingsDir, lang, theme]);

  const tr = useCallback((key: Parameters<typeof t>[1]) => t(lang, key), [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      theme,
      setTheme,
      exportDir,
      recordingsDir,
      setExportDir,
      setRecordingsDir,
      saveSettings,
      tr,
      settings,
    }),
    [
      lang,
      setLang,
      theme,
      setTheme,
      exportDir,
      recordingsDir,
      saveSettings,
      tr,
      settings,
    ]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings requires AppSettingsProvider");
  return ctx;
}
