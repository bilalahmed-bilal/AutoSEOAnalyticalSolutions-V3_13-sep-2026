import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app/dashboard/DashboardPanel.tsx"), "utf8");

test("dashboard getting-started active cards are keyboard-clickable and route to real tools", () => {
  assert.match(source, /title="Create a workspace"[\s\S]*?onClick=\{\(\) => \{/);
  assert.match(
    source,
    /title="Start with your Website"[\s\S]*?onClick=\{\(\) => onNavigate\?\.\("websiteOverview"\)\}/
  );
  assert.match(source, /title="Explore YouTube"[\s\S]*?onClick=\{\(\) => onNavigate\?\.\("ytKeywordResearch"\)\}/);
  assert.match(source, /title="Explore Facebook"[\s\S]*?onClick=\{\(\) => onNavigate\?\.\("fbPageSeo"\)\}/);
  assert.match(source, /nx-dashboard-setup-item-interactive/);
  assert.match(source, /<button[\s\S]*?type="button"[\s\S]*?focus-ring/);
});

test("coming-soon dashboard cards remain non-actionable", () => {
  const setupSection = source.split('<section className="nx-dashboard-setup-grid"')[1]?.split("</section>")[0] || "";
  for (const title of ["Instagram · Coming Soon", "WhatsApp · Coming Soon"]) {
    const titleIndex = setupSection.indexOf(`title="${title}"`);
    assert.ok(titleIndex >= 0, `${title} card is present`);
    const cardEnd = setupSection.indexOf("\n          />", titleIndex);
    assert.ok(cardEnd >= 0, `${title} card has a closing tag`);
    const card = setupSection.slice(setupSection.lastIndexOf("<SetupItem", titleIndex), cardEnd);
    assert.doesNotMatch(card, /onClick=/, `${title} must not be actionable while Coming Soon`);
  }
});
