import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretOAuthConsume, oauthConsumeErrorMessage } from "../lib/oauth/state-consume.ts";

const base = {
  id: "state-1",
  workspace_id: "ws-a",
  actor_user_id: "user-1",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
};

test("valid OAuth state consume succeeds", () => {
  const result = interpretOAuthConsume({
    deleted: [base],
    existing: [],
    provider: "google-youtube",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.row.workspace_id, "ws-a");
});

test("expired OAuth state is denied", () => {
  const result = interpretOAuthConsume({
    deleted: [],
    existing: [{ ...base, expires_at: new Date(Date.now() - 1000).toISOString(), provider: "google-youtube" }],
    provider: "google-youtube",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "expired");
    assert.match(oauthConsumeErrorMessage(result.reason), /expired/i);
  }
});

test("replayed OAuth state is denied", () => {
  const result = interpretOAuthConsume({
    deleted: [],
    existing: [],
    provider: "google-youtube",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "replayed");
});

test("wrong provider OAuth state is denied", () => {
  const result = interpretOAuthConsume({
    deleted: [],
    existing: [{ ...base, provider: "facebook" }],
    provider: "google-youtube",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "wrong_provider");
});

test("wrong workspace OAuth state is denied", () => {
  const result = interpretOAuthConsume({
    deleted: [{ ...base, workspace_id: "ws-b" }],
    existing: [],
    provider: "google-youtube",
    expectedWorkspaceId: "ws-a",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "wrong_workspace");
});
