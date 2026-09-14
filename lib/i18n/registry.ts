export type TextDirection = "ltr" | "rtl";
export type TranslationStatus = "complete" | "none";

export interface LanguageDefinition {
  code: string;
  name: string;
  nativeName: string;
  locale: string;
  direction: TextDirection;
  enabled: boolean;
  translationStatus: TranslationStatus;
}

/**
 * Central language registry. Enable a language by shipping a complete
 * message catalog and setting enabled=true. Do not show disabled languages
 * in the selector.
 */
export const LANGUAGE_REGISTRY: Record<string, LanguageDefinition> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    locale: "en-US",
    direction: "ltr",
    enabled: true,
    translationStatus: "complete",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    locale: "ar",
    direction: "rtl",
    enabled: false,
    translationStatus: "none",
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    locale: "de-DE",
    direction: "ltr",
    enabled: false,
    translationStatus: "none",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    locale: "fr-FR",
    direction: "ltr",
    enabled: false,
    translationStatus: "none",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    locale: "es-ES",
    direction: "ltr",
    enabled: false,
    translationStatus: "none",
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    locale: "it-IT",
    direction: "ltr",
    enabled: false,
    translationStatus: "none",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    locale: "pt-PT",
    direction: "ltr",
    enabled: false,
    translationStatus: "none",
  },
  nl: {
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    locale: "nl-NL",
    direction: "ltr",
    enabled: false,
    translationStatus: "none",
  },
  ur: {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    locale: "ur-PK",
    direction: "rtl",
    enabled: false,
    translationStatus: "none",
  },
};

export const DEFAULT_LANGUAGE_CODE = "en";
export const UI_LANGUAGE_COOKIE = "nexora_ui_lang";
export const UI_LANGUAGE_STORAGE_KEY = "nexora.uiLanguage";
export const WORKSPACE_LANGUAGE_STORAGE_PREFIX = "nexora.workspaceUiLanguage.";

export function languageDefinition(code?: string | null): LanguageDefinition {
  const normalized = String(code || "")
    .trim()
    .toLowerCase()
    .split("-")[0];
  return LANGUAGE_REGISTRY[normalized] || LANGUAGE_REGISTRY[DEFAULT_LANGUAGE_CODE];
}

export function isLanguageEnabled(code?: string | null): boolean {
  const entry =
    LANGUAGE_REGISTRY[
      String(code || "")
        .trim()
        .toLowerCase()
        .split("-")[0]
    ];
  return Boolean(entry?.enabled && entry.translationStatus === "complete");
}

export function enabledLanguages(): LanguageDefinition[] {
  return Object.values(LANGUAGE_REGISTRY).filter((item) => item.enabled && item.translationStatus === "complete");
}

export function selectableLanguages(): LanguageDefinition[] {
  return enabledLanguages();
}
