import { useI18n } from "../i18n/I18nProvider";
import type { Locale } from "../i18n/translations";

export function LanguageSwitcher() {
  const { locale, setLocale, tr } = useI18n();

  const options: { value: Locale; label: string }[] = [
    { value: "vi", label: tr("langVi") },
    { value: "ja", label: tr("langJa") },
  ];

  return (
    <div className="lang-switcher">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`lang-btn ${locale === opt.value ? "active" : ""}`}
          onClick={() => setLocale(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
