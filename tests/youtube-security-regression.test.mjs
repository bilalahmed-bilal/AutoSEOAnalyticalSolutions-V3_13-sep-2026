import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const youtubeRoutes = [
  "app/api/youtube-tools/videos/route.ts",
  "app/api/youtube-tools/retention/route.ts",
  "app/api/youtube-tools/community-post/route.ts",
  "app/api/youtube-tools/performance-intelligence/route.ts",
  "app/api/youtube-tools/approvals/route.ts",
  "app/api/youtube-tools/bulk-optimize/route.ts",
  "app/api/youtube-tools/keywords/route.ts",
  "app/api/youtube-tools/thumbnail-ab/route.ts",
  "app/api/youtube-tools/seo-fix/route.ts",
  "app/api/youtube-tools/competitors/route.ts",
  "app/api/youtube-tools/tags/route.ts",
];

test("all YouTube API routes use the shared YouTube access guard", () => {
  for (const file of youtubeRoutes) {
    const source = read(file);
    const hasChannelGuard = /requireYouTubeAccess\(/.test(source) && /isYouTubeSecurityContext\(/.test(source);
    const hasWorkspaceGuard = /requireWorkspaceRole\(/.test(source) && /isRoleResult\(/.test(source);
    const hasProductGuard = /requireProductAccess\(/.test(source);
    assert.ok(
      hasChannelGuard || hasWorkspaceGuard || hasProductGuard,
      `${file} must require authenticated workspace access`
    );
  }
});

test("YouTube mutation routes use same-origin protection", () => {
  const mutationRoutes = youtubeRoutes.filter((file) => file !== "app/api/youtube-tools/approvals/route.ts");
  for (const file of mutationRoutes) {
    const source = read(file);
    if (/export async function (POST|PUT|PATCH|DELETE)/.test(source)) {
      assert.match(source, /sameOriginWrite\(/, `${file} must protect browser mutations against cross-origin writes`);
    }
  }
});

test("YouTube routes do not regress to the legacy global publish settings store", () => {
  for (const file of youtubeRoutes) {
    const source = read(file);
    assert.doesNotMatch(source, /getPublishSettings\(/, `${file} must not bypass workspace-scoped connections`);
  }
});

test("bulk YouTube optimization remains approval-gated", () => {
  const source = read("app/api/youtube-tools/bulk-optimize/route.ts");
  assert.match(source, /evaluateYouTubeRisk\("bulk_metadata_update"/);
  assert.match(source, /createApproval\(/);
  assert.match(source, /status:\s*"pending"/);
});

test("approval review is workspace-scoped and only transitions pending approvals", () => {
  const source = read("lib/approval/repository.ts");
  assert.match(source, /workspace_id:\s*`eq\.\$\{ctx\.workspaceId\}`/);
  assert.match(source, /status:\s*"eq\.pending"/);
  assert.match(source, /reviewed_by:\s*ctx\.reviewerId/);
});

test("critical YouTube actions cannot be auto-executed", () => {
  const source = read("lib/approval/risk.ts");
  assert.match(source, /delete_video:\s*"critical"/);
  assert.match(source, /if \(decision\.risk === "critical"\) return "blocked"/);
  assert.match(source, /autoExecutable = risk === "low" && requestedMode === "auto"/);
});

test("V44 approval migration enables RLS and admin-only review writes", () => {
  const source = read("supabase/v44-youtube-approval-risk.sql");
  assert.match(source, /enable row level security/i);
  assert.match(source, /action_approvals_update_admins/);
  assert.match(source, /is_workspace_admin\(workspace_id\)/);
  assert.match(source, /prevent_workspace_id_change/);
});
