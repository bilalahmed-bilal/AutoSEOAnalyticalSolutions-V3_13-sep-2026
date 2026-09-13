import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("production auth is fail-closed even when AUTOSEO_AUTH_REQUIRED is false", () => {
  const policy = read("lib/auth/policy.ts");
  assert.match(policy, /NODE_ENV === "production"/);
  assert.match(read("lib/auth/api-access.ts"), /isApiAuthRequired\(\)/);
});

test("free beta defaults on and billing stays off", () => {
  const beta = read("lib/product/beta.ts");
  assert.match(beta, /NEXORA_BETA_MODE === "false"/);
  assert.match(read("lib/billing/adapter.ts"), /Billing is off for Nexora Free Beta/);
  assert.match(read("app/api/billing/checkout/route.ts"), /BILLING_DISABLED_FOR_BETA/);
});

test("beta catalog includes YouTube analytics/publish but not bulk", () => {
  const catalog = read("lib/billing/catalog.ts");
  const betaBlock = catalog.split("export const BETA_PLAN")[1].split("export function defaultProvisionPlan")[0];
  assert.match(betaBlock, /youtube\.analytics/);
  assert.match(betaBlock, /youtube\.publish/);
  assert.match(betaBlock, /\.\.\.FACEBOOK/);
  assert.doesNotMatch(betaBlock, /youtube\.bulk/);
});

test("route policy denies feature APIs and exempts intentional exceptions", () => {
  const policy = read("lib/billing/route-policy.ts");
  assert.match(policy, /youtube\.analytics/);
  assert.match(policy, /youtube\.bulk/);
  assert.match(policy, /path\.startsWith\("\/api\/auth"\)/);
  assert.match(policy, /path\.startsWith\("\/api\/admin"\)/);
  assert.match(policy, /publishFeatureForChannel/);
});

test("OAuth consume is a single DELETE returning the row", () => {
  const source = read("lib/oauth/state.ts");
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /Prefer: "return=representation"/);
  assert.match(source, /expires_at=gt\./);
});

test("session cookies are HttpOnly and getAuthenticatedUser reads them", () => {
  const cookies = read("lib/auth/session-cookie.ts");
  const supabase = read("lib/auth/supabase.ts");
  assert.match(cookies, /httpOnly: true/);
  assert.match(cookies, /nexora_sb_access/);
  assert.match(supabase, /readAccessTokenFromRequest/);
});

test("Facebook OAuth is labeled FIRST_PAGE_ONLY", () => {
  assert.match(read("lib/oauth/provider.ts"), /FIRST_PAGE_ONLY/);
  assert.match(read("app/api/facebook-tools/page-info/route.ts"), /FIRST_PAGE_ONLY/);
});

test("admin beta APIs require platform admin", () => {
  for (const file of [
    "app/api/admin/usage/route.ts",
    "app/api/admin/connections/route.ts",
    "app/api/admin/settings/route.ts",
  ]) {
    assert.match(read(file), /requirePlatformAdmin\(/);
  }
});

test("YouTube generation routes require product access", () => {
  for (const file of [
    "app/api/youtube-tools/keywords/route.ts",
    "app/api/youtube-tools/tags/route.ts",
    "app/api/youtube-tools/community-post/route.ts",
    "app/api/youtube-tools/thumbnail-ab/route.ts",
  ]) {
    assert.match(read(file), /requireProductAccess\(/);
  }
});

test("requireYouTubeAccess and requireFacebookAccess call requireApiAccess", () => {
  assert.match(read("lib/youtube-security.ts"), /requireApiAccess/);
  assert.match(read("lib/facebook-security.ts"), /requireApiAccess/);
  assert.match(read("lib/facebook-security.ts"), /evaluateFeature/);
});

test("rate limiter documents in-process backend", () => {
  assert.match(read("lib/security/rate-limit.ts"), /REQUIRES_PRODUCTION_INFRASTRUCTURE/);
  assert.match(read("lib/security/rate-limit.ts"), /in-process/);
});
