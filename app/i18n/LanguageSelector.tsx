"use client";

import { useUiLanguage } from "@/app/i18n/LanguageProvider";

export default function LanguageSelector({ id = "ui-language", compact = false }: { id?: string; compact?: boolean }) {
  const { language, options, setUiLanguage, t } = useUiLanguage();
  const select = (
    <select
      id={id}
      aria-label={t("settings.language")}
      value={language.code}
      onChange={(e) => void setUiLanguage(e.target.value)}
      className={
        compact
          ? "min-h-9 rounded-[var(--nx-radius-sm)] border border-line bg-elevated px-2.5 py-1.5 text-xs text-ink"
          : "mt-1 w-full max-w-xs rounded-[var(--nx-radius-sm)] border border-line bg-elevated px-3 py-2 text-sm text-ink"
      }
    >
      {options.map((item) => (
        <option key={item.code} value={item.code}>
          {item.name}
        </option>
      ))}
    </select>
  );
  if (compact) return select;
  return (
    <label className="block text-sm" htmlFor={id}>
      {t("settings.language")}
      {select}
      <p className="mt-1 text-xs text-ink/50">{t("settings.language.help")}</p>
    </label>
  );
}
