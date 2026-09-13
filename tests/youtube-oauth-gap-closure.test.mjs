import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

function walkFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx|js|mjs|md)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

test("provider youtube maps to Google YouTube OAuth refresh config", () => {
  const config = read("lib/oauth/config.ts");
  const lifecycle = read("lib/oauth/lifecycle.ts");
  assert.match(config, /YOUTUBE_CONNECTION_PROVIDER = "youtube"/);
  assert.match(
    config,
    /connectionProvider === YOUTUBE_CONNECTION_PROVIDER \|\| connectionProvider === "google-youtube"/
  );
  assert.match(lifecycle, /googleOAuthConfigProvider\(String\(connection\.provider/);
  assert.match(lifecycle, /oauthConfig\(oauthProvider\)/);
  assert.doesNotMatch(lifecycle, /provider !== "google-youtube" && provider !== "google-search-console"/);
});

test("google-youtube remains a supported OAuth helper identity", () => {
  const config = read("lib/oauth/config.ts");
  const refresh = read("lib/oauth/refresh.ts");
  const start = read("app/api/oauth/[provider]/route.ts");
  assert.match(config, /export type OAuthProvider = "google-youtube"/);
  assert.match(refresh, /provider: "google-youtube"/);
  assert.match(start, /google-youtube/);
  const provider = read("lib/oauth/provider.ts");
  assert.match(provider, /upsertConnection\(workspaceId, "youtube"/);
  assert.doesNotMatch(provider, /upsertConnection\(workspaceId, "google-youtube"/);
});

test("YouTube OAuth requests Data API and Analytics read scopes only", () => {
  const config = read("lib/oauth/config.ts");
  assert.match(config, /YOUTUBE_DATA_SCOPE = "https:\/\/www\.googleapis\.com\/auth\/youtube\.force-ssl"/);
  assert.match(config, /YOUTUBE_ANALYTICS_SCOPE = "https:\/\/www\.googleapis\.com\/auth\/yt-analytics\.readonly"/);
  assert.match(config, /YOUTUBE_OAUTH_SCOPES = \[YOUTUBE_DATA_SCOPE, YOUTUBE_ANALYTICS_SCOPE\]/);
  assert.doesNotMatch(config, /yt-analytics-monetary/);
  assert.doesNotMatch(config, /youtube\.upload/);
  assert.doesNotMatch(config, /youtube\.readonly/);
});

test("legacy tokens without Analytics scope require reconnect and are not treated as granted", () => {
  const config = read("lib/oauth/config.ts");
  const retention = read("lib/publishers/youtube.ts");
  const deep = read("lib/analytics/youtube-deep.ts");
  assert.match(config, /youtubeTokenGrantsAnalytics/);
  assert.match(config, /assertYouTubeAnalyticsAuthorized/);
  assert.match(config, /YouTubeAnalyticsAuthorizationError/);
  assert.match(retention, /assertYouTubeAnalyticsAuthorized\(settings\.scope\)/);
  assert.match(deep, /assertYouTubeAnalyticsAuthorized\(settings\.scope\)/);
  assert.match(retention, /YouTubeAnalyticsAuthorizationError/);
  assert.doesNotMatch(retention, /OAuth Playground/);
  assert.doesNotMatch(deep, /res\.text\(\)/);
});

test("no obsolete youtube-facebook-setup.md references remain", () => {
  const files = walkFiles(root);
  const hits = [];
  for (const file of files) {
    if (file.endsWith("youtube-oauth-gap-closure.test.mjs")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes("youtube-facebook-setup.md")) hits.push(path.relative(root, file));
  }
  assert.deepEqual(hits, [], `obsolete setup doc still referenced in: ${hits.join(", ")}`);
});

test("YouTube connection UI points at in-app OAuth and INTEGRATIONS.md", () => {
  const page = read("app/page.tsx");
  assert.match(page, /Connect with Google OAuth/);
  assert.match(page, /docs\/INTEGRATIONS\.md/);
  assert.match(page, /legacy\/testing-only/);
  assert.doesNotMatch(page, /youtube-facebook-setup/);
});

test("Analytics authorization failures map to 403 without raw provider payloads", () => {
  const retentionRoute = read("app/api/youtube-tools/retention/route.ts");
  const intelligenceRoute = read("app/api/youtube-tools/performance-intelligence/route.ts");
  const publisher = read("lib/publishers/youtube.ts");
  const deep = read("lib/analytics/youtube-deep.ts");
  assert.match(retentionRoute, /YouTubeAnalyticsAuthorizationError \? 403/);
  assert.match(intelligenceRoute, /YouTubeAnalyticsAuthorizationError \? 403/);
  assert.doesNotMatch(publisher, /\$\{errText\}/);
  assert.doesNotMatch(deep, /res\.text\(\)/);
  assert.doesNotMatch(publisher, /OAuth Playground/);
});

test("YouTube gap-closure does not change Facebook OAuth scopes or DB provider names", () => {
  const config = read("lib/oauth/config.ts");
  const provider = read("lib/oauth/provider.ts");
  assert.match(config, /scopes: \["pages_show_list", "pages_read_engagement", "pages_manage_posts"\]/);
  assert.match(provider, /upsertConnection\(workspaceId, "google-search-console"/);
  assert.match(provider, /upsertConnection\(workspaceId, "youtube"/);
  assert.match(provider, /upsertConnection\(workspaceId, "facebook"/);
});
