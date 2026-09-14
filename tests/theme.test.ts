import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isThemeMode,
  parseThemeMode,
  resolveTheme,
  THEME_BOOT_SCRIPT,
  THEME_COOKIE,
  THEME_MODES,
  THEME_STORAGE_KEY,
} from "../lib/theme/preference.ts";
import { SIDEBAR_SECTIONS } from "../lib/ui/nav.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

test("default theme mode is system and resolves from OS preference", () => {
  assert.deepEqual(THEME_MODES, ["light", "dark", "system"]);
  assert.equal(parseThemeMode(null), "system");
  assert.equal(parseThemeMode("nope"), "system");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("theme preference keys are cookie and localStorage, not a schema change", () => {
  assert.equal(THEME_COOKIE, "nexora_theme");
  assert.equal(THEME_STORAGE_KEY, "nexora.theme");
  assert.match(THEME_BOOT_SCRIPT, /nexora_theme/);
  assert.match(THEME_BOOT_SCRIPT, /prefers-color-scheme: dark/);
  assert.match(read("app/layout.tsx"), /THEME_BOOT_SCRIPT/);
  assert.match(read("app/api/preferences/route.ts"), /theme/);
  assert.equal(read("app/api/preferences/route.ts").includes("CREATE TABLE"), false);
});

test("invalid stored theme values fall back to system", () => {
  assert.equal(isThemeMode("cyber"), false);
  assert.equal(parseThemeMode("cyber"), "system");
});

test("sidebar keeps existing destinations and does not invent calendar", () => {
  const labels = SIDEBAR_SECTIONS.flatMap((section) =>
    section.items.flatMap((item) => [item.label, ...(item.children || []).map((child) => child.label)])
  );
  assert.ok(labels.includes("Dashboard"));
  assert.ok(labels.includes("Websites"));
  assert.ok(labels.includes("Website Overview"));
  assert.ok(labels.includes("SEO Health"));
  assert.ok(labels.includes("Keyword Research"));
  assert.ok(labels.includes("Content Generator"));
  assert.ok(labels.includes("YouTube"));
  assert.ok(labels.includes("Facebook"));
  assert.ok(labels.includes("Instagram"));
  assert.ok(labels.includes("WhatsApp"));
  assert.ok(labels.includes("Website Builder · Coming Soon"));
  assert.ok(labels.includes("Instagram · Coming Soon"));
  assert.ok(labels.includes("Marketing · Coming Soon"));
  assert.ok(
    labels.includes("SEO & Growth") ||
      SIDEBAR_SECTIONS.some((section) =>
        section.items.some((item) => item.children?.some((child) => child.group === "SEO & Growth"))
      )
  );
  assert.ok(labels.includes("Analytics"));
  assert.ok(labels.includes("Approvals"));
  assert.ok(labels.includes("Publishing"));
  assert.ok(labels.includes("Usage"));
  assert.ok(labels.includes("Subscription"));
  assert.ok(labels.includes("Automation"));
  assert.ok(labels.includes("Connections"));
  assert.ok(labels.includes("Settings"));
  assert.equal(labels.includes("Calendar"), false);
});

test("design tokens define dark and light themes without inverting ink as a single color", () => {
  const css = read("app/globals.css");
  assert.match(css, /data-theme="light"/);
  assert.match(css, /--nx-bg:/);
  assert.match(css, /--nx-primary:/);
  assert.match(css, /--nx-ai:/);
  assert.doesNotMatch(css, /Fraunces/);
  assert.match(css, /Inter/);
});

test("customer UI remains English-only while theme is independent", () => {
  const selector = read("app/i18n/LanguageSelector.tsx");
  assert.match(selector, /options\.map/);
  assert.doesNotMatch(selector, /Urdu UI/);
  assert.match(read("app/theme/ThemeToggle.tsx"), /Light/);
  assert.match(read("app/theme/ThemeToggle.tsx"), /Dark/);
  assert.match(read("app/theme/ThemeToggle.tsx"), /System/);
});
