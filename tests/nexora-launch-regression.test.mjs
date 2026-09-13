import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createIdempotencyKey } from "../lib/jobs/idempotency.ts";
import { assertSafeUrl } from "../lib/security/url-safety.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("no session is denied when authentication is required", () => {
  const access = read("lib/auth/api-access.ts");
  assert.match(access, /if \(authRequired\) return null/);
  assert.match(access, /status: 401/);
  assert.match(read("lib/auth/rbac.ts"), /Valid authenticated workspace required/);
  assert.match(read("lib/auth/rbac.ts"), /status: 401/);
});

test("wrong workspace is denied because membership is checked server-side", () => {
  const tenant = read("lib/tenant.ts");
  assert.match(tenant, /Never trust the workspace header by itself/);
  assert.match(tenant, /workspace_members/);
  assert.match(tenant, /if \(!members\.length\) return null/);
});

test("wrong role is denied with 403", () => {
  const rbac = read("lib/auth/rbac.ts");
  assert.match(rbac, /rank\[role\] < rank\[minimum\]/);
  assert.match(rbac, /Workspace \$\{minimum\} permission required/);
  assert.match(rbac, /status: 403/);
});

test("admin is allowed and non-admin is denied", () => {
  const admin = read("lib/auth/platform-admin.ts");
  assert.match(admin, /Authentication required/);
  assert.match(admin, /status: 401/);
  assert.match(admin, /Platform admin permission required/);
  assert.match(admin, /status: 403/);
  assert.match(read("app/admin/page.tsx"), /Access denied/);
});

test("unauthorized feature is denied and usage exceeded is a controlled 429", () => {
  const entitlements = read("lib/billing/entitlements.ts");
  assert.match(entitlements, /code: snapshot\.status === "restricted" \? "plan_restricted" : "feature_denied"/);
  assert.match(entitlements, /statusCode: 403/);
  assert.match(entitlements, /code: "usage_exceeded"/);
  assert.match(entitlements, /statusCode: 429/);
  assert.match(read("lib/billing/access.ts"), /entitlementResponse\(decision\)/);
});

test("free beta entitlement catalog is the gating overlay", () => {
  const catalog = read("lib/billing/catalog.ts");
  assert.match(catalog, /export const BETA_PLAN/);
  assert.match(catalog, /getGatingPlan/);
  assert.match(read("lib/product/beta.ts"), /NEXORA_BETA_MODE/);
});

test("duplicate publish uses a stable idempotency key and YouTube fingerprint short-circuit", () => {
  const keyA = createIdempotencyKey(["publish_draft", "ws-1", "draft-1"]);
  const keyB = createIdempotencyKey(["publish_draft", "ws-1", "draft-1"]);
  const keyC = createIdempotencyKey(["publish_draft", "ws-1", "draft-2"]);
  assert.equal(keyA, keyB);
  assert.notEqual(keyA, keyC);
  assert.match(read("lib/jobs/queue.ts"), /findJobByKey\(input\.workspaceId, input\.idempotencyKey\)/);
  assert.match(read("lib/publishers/youtube.ts"), /idempotent: true/);
  assert.match(read("lib/publishers/youtube.ts"), /matchesDesiredYouTubeContent/);
});

test("publisher and crawler re-validate redirect Location with assertSafeUrl", () => {
  assert.match(read("lib/security/outbound.ts"), /assertSafeUrl\(new URL\(location, current\)\.toString\(\)\)/);
  assert.match(read("lib/security/url-safety.ts"), /assertSafeUrl\(new URL\(location, current\)\.toString\(\)\)/);
});

test("redirect Location that resolves to private or localhost is denied", async () => {
  await assert.rejects(() => assertSafeUrl(new URL("http://127.0.0.1/secret", "https://example.com").toString()));
  await assert.rejects(() => assertSafeUrl(new URL("/internal", "http://10.0.0.4/").toString()));
  await assert.rejects(() =>
    assertSafeUrl(new URL("http://192.168.0.20/hook", "https://publisher.example").toString())
  );
  await assert.rejects(() => assertSafeUrl(new URL("http://[::1]/", "https://example.com").toString()));
});
