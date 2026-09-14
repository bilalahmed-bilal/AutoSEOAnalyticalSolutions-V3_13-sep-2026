/**
 * Content / AI generation language is independent of UI language.
 * These options may include Urdu even while the UI stays English-only.
 */
export type ContentLanguageCode = "en" | "ur" | "roman-ur";

export const CONTENT_LANGUAGES: { id: ContentLanguageCode; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ur", label: "Urdu" },
  { id: "roman-ur", label: "Roman Urdu" },
];

export const DEFAULT_CONTENT_LANGUAGE: ContentLanguageCode = "en";
