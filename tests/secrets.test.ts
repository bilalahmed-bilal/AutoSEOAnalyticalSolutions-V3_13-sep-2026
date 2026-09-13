import assert from "node:assert/strict";
import { test } from "node:test";
import { secretsMatch } from "../lib/security/secrets.ts";

test("secretsMatch accepts equal values", () => {
  assert.equal(secretsMatch("worker-secret", "worker-secret"), true);
});

test("secretsMatch rejects mismatches and empty values", () => {
  assert.equal(secretsMatch("worker-secret", "other-secret"), false);
  assert.equal(secretsMatch("", "worker-secret"), false);
  assert.equal(secretsMatch(null, "worker-secret"), false);
  assert.equal(secretsMatch("worker-secret", undefined), false);
});
