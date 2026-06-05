import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { loadLocale, t, type Locale, type TranslationKey } from "./translations";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tr: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem("imagesplat-locale", next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next === "ja" ? "ja" : "vi";
  }, []);

  const tr = useCallback((key: TranslationKey) => t(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, tr }), [locale, setLocale, tr]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
