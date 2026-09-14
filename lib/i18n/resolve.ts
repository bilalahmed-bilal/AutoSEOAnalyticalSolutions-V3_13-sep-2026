import { DEFAULT_LANGUAGE_CODE, isLanguageEnabled, languageDefinition, type LanguageDefinition } from "./registry";

export interface LanguagePreferenceInput {
  userLanguage?: string | null;
  workspaceLanguage?: string | null;
  storedLanguage?: string | null;
}

/**
 * Fallback: user → workspace → stored/cookie → application default (English).
 * Disabled or unknown codes never win.
 */
export function resolveUiLanguage(input: LanguagePreferenceInput = {}): LanguageDefinition {
  const candidates = [input.userLanguage, input.workspaceLanguage, input.storedLanguage, DEFAULT_LANGUAGE_CODE];
  for (const candidate of candidates) {
    if (isLanguageEnabled(candidate)) return languageDefinition(candidate);
  }
  return languageDefinition(DEFAULT_LANGUAGE_CODE);
}
