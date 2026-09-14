import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SIDEBAR_SECTIONS } from "../lib/ui/nav.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("More Tools children are grouped into SEO, AI, Operations, and Management", () => {
  const moreTools = SIDEBAR_SECTIONS.flatMap((section) => section.items).find((item) => item.label === "More Tools");
  assert.ok(moreTools?.children?.length);
  const groups = [...new Set(moreTools.children.map((child) => child.group))];
  assert.deepEqual(groups, ["SEO & Growth", "AI", "Operations", "Management"]);
  assert.ok(moreTools.children.some((child) => child.label === "Keywords" && child.group === "SEO & Growth"));
  assert.ok(moreTools.children.some((child) => child.label === "AI Strategist" && child.group === "AI"));
  assert.ok(moreTools.children.some((child) => child.label === "Approvals" && child.group === "Operations"));
  assert.ok(moreTools.children.some((child) => child.label === "Connections" && child.group === "Management"));
});

test("Instagram, WhatsApp, and Website Builder remain Coming Soon in navigation", () => {
  const labels = SIDEBAR_SECTIONS.flatMap((section) =>
    section.items.flatMap((item) => [item.label, ...(item.children || []).map((child) => child.label)])
  );
  assert.ok(labels.some((label) => /Instagram/.test(label) && /Coming Soon/.test(label)));
  assert.ok(labels.some((label) => /WhatsApp|Marketing/.test(label) && /Coming Soon/.test(label)));
  assert.ok(labels.includes("Website Builder · Coming Soon"));
});

test("AIBISORA mark replaced the old Nexora logo file", () => {
  assert.equal(fs.existsSync(path.join(root, "public/aibisora-mark.svg")), true);
  assert.equal(fs.existsSync(path.join(root, "public/favicon.svg")), true);
  assert.equal(fs.existsSync(path.join(root, "public/og.png")), true);
  assert.equal(fs.existsSync(path.join(root, "public/nexora-mark.svg")), false);
});
