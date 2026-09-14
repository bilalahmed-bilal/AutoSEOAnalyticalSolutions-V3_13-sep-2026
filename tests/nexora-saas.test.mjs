import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("production auth policy is wired into requireApiAccess", () => {
  const source = read("lib/auth/api-access.ts");
  assert.match(source, /isApiAuthRequired\(\)/);
  assert.doesNotMatch(source, /const authRequired = process\.env\.AUTOSEO_AUTH_REQUIRED === "true"/);
});

test("AIBISORA branding is centralized and used in customer-facing metadata", () => {
  const brand = read("lib/product/brand.ts");
  const layout = read("app/layout.tsx");
  const page = read("app/page.tsx");
  assert.match(brand, /productName: "AIBISORA"/);
  assert.match(brand, /From Web to Social, Your Complete Business Solution\./);
  assert.match(layout, /productBrand/);
  assert.match(page, /productBrand\.productName/);
  assert.doesNotMatch(read("app/layout.tsx"), /Nexora/);
});

test("entitlement catalog includes required feature keys and does not grant bulk on Free", () => {
  const catalog = read("lib/billing/catalog.ts");
  assert.match(catalog, /youtube\.connect/);
  assert.match(catalog, /youtube\.analytics/);
  assert.match(catalog, /facebook\.publish/);
  const freeBlock = catalog.split('slug: "free"')[1].split('slug: "starter"')[0];
  assert.match(freeBlock, /youtube\.connect/);
  assert.match(freeBlock, /youtube\.seo/);
  assert.doesNotMatch(freeBlock, /youtube\.bulk/);
  assert.doesNotMatch(freeBlock, /facebook\.connect/);
  const proBlock = catalog.split('slug: "pro",')[1].split('slug: "pro-plus"')[0];
  assert.match(proBlock, /YOUTUBE_FULL/);
  assert.match(proBlock, /FACEBOOK/);
});

test("publisher adapters use independent outbound SSRF protection", () => {
  assert.match(read("lib/publishers/wordpress.ts"), /safeOutboundFetch/);
  assert.match(read("lib/publishers/custom-site.ts"), /safeOutboundFetch/);
  assert.match(read("lib/publishers/shopify.ts"), /safeOutboundFetch/);
  assert.match(read("lib/publishers/shopify.ts"), /myshopify\.com/);
  assert.match(read("lib/security/outbound.ts"), /assertSafeUrl/);
});

test("Facebook channel routes no longer use the unauthenticated local publish store", () => {
  const files = [
    "app/api/facebook-tools/page-info/route.ts",
    "app/api/facebook-tools/posts/route.ts",
    "app/api/facebook-tools/comments/route.ts",
    "app/api/facebook-tools/audience-insights/route.ts",
    "app/api/facebook-tools/competitors/route.ts",
    "app/api/facebook-tools/hashtags/route.ts",
    "app/api/facebook-tools/post-ab/route.ts",
    "app/api/facebook-tools/bulk-scheduler/route.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /getPublishSettings\(/, `${file} still uses local publish settings`);
    assert.match(source, /requireProductAccess\(/, `${file} must check entitlements`);
  }
});

test("admin APIs require platform admin authorization", () => {
  for (const file of [
    "app/api/admin/session/route.ts",
    "app/api/admin/overview/route.ts",
    "app/api/admin/workspaces/route.ts",
    "app/api/admin/plans/route.ts",
    "app/api/admin/entitlements/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/admin/audit/route.ts",
    "app/api/admin/usage/route.ts",
    "app/api/admin/connections/route.ts",
    "app/api/admin/settings/route.ts",
  ]) {
    assert.match(read(file), /requirePlatformAdmin\(/);
  }
});

test("billing checkout never trusts a browser payment status", () => {
  const adapter = read("lib/billing/adapter.ts");
  const checkout = read("app/api/billing/checkout/route.ts");
  assert.match(adapter, /BillingNotConfiguredError/);
  assert.match(checkout, /REQUIRES_CONFIGURATION/);
  assert.doesNotMatch(checkout, /paid.*true/);
});
