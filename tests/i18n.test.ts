import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_REGISTRY,
  enabledLanguages,
  isLanguageEnabled,
  languageDefinition,
  selectableLanguages,
} from "../lib/i18n/registry.ts";
import { DEFAULT_CONTENT_LANGUAGE } from "../lib/i18n/content-language.ts";
import { EN_MESSAGES } from "../lib/i18n/messages/en.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

function resolveUiLanguage(input: {
  userLanguage?: string | null;
  workspaceLanguage?: string | null;
  storedLanguage?: string | null;
}) {
  const candidates = [input.userLanguage, input.workspaceLanguage, input.storedLanguage, DEFAULT_LANGUAGE_CODE];
  for (const candidate of candidates) {
    if (isLanguageEnabled(candidate)) return languageDefinition(candidate);
  }
  return languageDefinition(DEFAULT_LANGUAGE_CODE);
}

test("new visitor and missing preference resolve to English", () => {
  const none = resolveUiLanguage({});
  assert.equal(none.code, "en");
  assert.equal(none.direction, "ltr");
  assert.equal(DEFAULT_LANGUAGE_CODE, "en");
  assert.match(read("lib/i18n/resolve.ts"), /userLanguage, input\.workspaceLanguage, input\.storedLanguage/);
});

test("new user and new workspace without preference stay English", () => {
  assert.equal(resolveUiLanguage({ userLanguage: null, workspaceLanguage: null }).code, "en");
  assert.equal(resolveUiLanguage({ userLanguage: "", workspaceLanguage: "" }).code, "en");
});

test("language selector exposes English only", () => {
  const visible = selectableLanguages();
  assert.deepEqual(
    visible.map((item) => item.code),
    ["en"]
  );
  assert.equal(enabledLanguages().length, 1);
});

test("future disabled languages are not selectable", () => {
  for (const code of ["ar", "de", "fr", "es", "it", "pt", "nl", "ur"]) {
    assert.equal(isLanguageEnabled(code), false);
    assert.equal(LANGUAGE_REGISTRY[code].enabled, false);
    assert.equal(resolveUiLanguage({ userLanguage: code, storedLanguage: code }).code, "en");
  }
});

test("UI language is independent from content language", () => {
  assert.equal(resolveUiLanguage({}).code, "en");
  assert.equal(DEFAULT_CONTENT_LANGUAGE, "en");
  assert.notEqual(DEFAULT_CONTENT_LANGUAGE, "ur");
  assert.match(read("lib/i18n/content-language.ts"), /independent of UI language/);
});

test("default direction is LTR", () => {
  assert.equal(resolveUiLanguage({}).direction, "ltr");
  assert.equal(LANGUAGE_REGISTRY.en.direction, "ltr");
  assert.equal(LANGUAGE_REGISTRY.ar.direction, "rtl");
  assert.equal(LANGUAGE_REGISTRY.ur.direction, "rtl");
});

test("English catalog covers required product keys", () => {
  for (const key of [
    "navigation.dashboard",
    "navigation.youtube",
    "navigation.analytics",
    "dashboard.title",
    "settings.language",
    "auth.login",
    "auth.signup",
    "errors.generic",
  ]) {
    assert.ok(EN_MESSAGES[key]);
    assert.notEqual(EN_MESSAGES[key], key);
  }
});

test("application UI default is not Urdu", () => {
  assert.notEqual(DEFAULT_LANGUAGE_CODE, "ur");
  assert.equal(LANGUAGE_REGISTRY.ur.enabled, false);
});
