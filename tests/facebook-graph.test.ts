import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FACEBOOK_GRAPH_VERSION,
  facebookGraphApiBase,
  facebookGraphVersion,
  facebookOAuthDialogUrl,
  facebookOAuthTokenUrl,
} from "../lib/oauth/facebook-graph.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

test("Meta Graph API defaults to v26.0 and rejects invalid overrides", () => {
  assert.equal(DEFAULT_FACEBOOK_GRAPH_VERSION, "v26.0");
  assert.equal(facebookGraphVersion({}), "v26.0");
  assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: "v26.0" }), "v26.0");
  assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: "v20.0" }), "v26.0");
  assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: "v21.0" }), "v21.0");
  assert.equal(facebookGraphVersion({ FACEBOOK_GRAPH_VERSION: "latest" }), "v26.0");
  assert.equal(facebookGraphApiBase({}), "https://graph.facebook.com/v26.0");
  assert.equal(facebookOAuthDialogUrl({}), "https://www.facebook.com/v26.0/dialog/oauth");
  assert.equal(facebookOAuthTokenUrl({}), "https://graph.facebook.com/v26.0/oauth/access_token");
});

test("production Facebook paths no longer hard-code Graph API v20.0", () => {
  for (const file of [
    "lib/oauth/config.ts",
    "lib/oauth/provider.ts",
    "lib/publishers/facebook.ts",
    "lib/analytics/facebook.ts",
    ".env.local.example",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /v20\.0/, `${file} still references Graph API v20.0`);
    if (file !== ".env.local.example") {
      assert.match(source, /facebookGraph|FACEBOOK_GRAPH_VERSION|facebookOAuth/, `${file} must use the version helper`);
    }
  }
  assert.match(read(".env.local.example"), /FACEBOOK_GRAPH_VERSION=v26\.0/);
});
