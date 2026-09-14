import { EN_MESSAGES } from "./messages/en";
import { DEFAULT_LANGUAGE_CODE, isLanguageEnabled } from "./registry";

const CATALOGS: Record<string, Record<string, string>> = {
  en: EN_MESSAGES,
};

export function messagesFor(code?: string | null): Record<string, string> {
  const normalized = String(code || DEFAULT_LANGUAGE_CODE)
    .trim()
    .toLowerCase()
    .split("-")[0];
  if (isLanguageEnabled(normalized) && CATALOGS[normalized]) return CATALOGS[normalized];
  return EN_MESSAGES;
}

export function translate(key: string, vars: Record<string, string | number> = {}, code?: string | null): string {
  const table = messagesFor(code);
  const template = table[key] ?? EN_MESSAGES[key];
  if (!template) return EN_MESSAGES["errors.generic"] || "Something went wrong. Please try again.";
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined || vars[name] === null ? "" : String(vars[name])
  );
}

export function hasMessage(key: string, code?: string | null): boolean {
  return Boolean(messagesFor(code)[key] || EN_MESSAGES[key]);
}
