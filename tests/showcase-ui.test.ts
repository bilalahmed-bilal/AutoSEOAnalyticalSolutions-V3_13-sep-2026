import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

test("showcase screens keep English UI and real-data empty states", () => {
  const dashboard = read("app/dashboard/DashboardPanel.tsx");
  const page = read("app/page.tsx");
  const api = read("app/api/dashboard/route.ts");

  assert.match(dashboard, /Build your AIBISORA workspace/);
  assert.match(dashboard, /Open Website Tools/);
  assert.match(dashboard, /seoHistory/);
  assert.match(api, /seoHistory: seo/);
  assert.match(dashboard, /Run your first SEO audit/);
  assert.match(page, /Fix with AI/);
  assert.match(page, /Apply after approval/);
  assert.match(page, /Generate Content/);
  assert.match(page, /Content language/);
  assert.match(page, /No analytics data yet/);
  assert.doesNotMatch(page, /Create content/);
  assert.doesNotMatch(dashboard, /sample traffic/i);
});
