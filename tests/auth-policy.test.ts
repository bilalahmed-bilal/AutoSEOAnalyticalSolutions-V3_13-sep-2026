import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiAuthRequired } from "../lib/auth/policy.ts";

test("production always requires authentication even if the flag is omitted", () => {
  assert.equal(isApiAuthRequired({ NODE_ENV: "production" }), true);
});

test("production requires authentication even when AUTOSEO_AUTH_REQUIRED is false", () => {
  assert.equal(isApiAuthRequired({ NODE_ENV: "production", AUTOSEO_AUTH_REQUIRED: "false" }), true);
});

test("development allows the documented demo fallback when the flag is not true", () => {
  assert.equal(isApiAuthRequired({ NODE_ENV: "development" }), false);
  assert.equal(isApiAuthRequired({ NODE_ENV: "development", AUTOSEO_AUTH_REQUIRED: "false" }), false);
});

test("development requires authentication when AUTOSEO_AUTH_REQUIRED=true", () => {
  assert.equal(isApiAuthRequired({ NODE_ENV: "development", AUTOSEO_AUTH_REQUIRED: "true" }), true);
});

test("test NODE_ENV follows the development/demo rule unless the flag is true", () => {
  assert.equal(isApiAuthRequired({ NODE_ENV: "test" }), false);
  assert.equal(isApiAuthRequired({ NODE_ENV: "test", AUTOSEO_AUTH_REQUIRED: "true" }), true);
});
