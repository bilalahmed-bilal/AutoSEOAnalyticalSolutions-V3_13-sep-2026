import test from "node:test";
import assert from "node:assert/strict";
import { sameOriginWriteFromParts } from "../lib/security/origin.ts";
import { publicErrorMessage } from "../lib/security/public-message.ts";

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name] || values[name.toLowerCase()] || null;
    },
  };
}

const url = "http://localhost:3000/api/queue";

test("cookie-authenticated writes require a matching Origin", () => {
  assert.equal(sameOriginWriteFromParts("POST", headers({}), url), false);
  assert.equal(sameOriginWriteFromParts("POST", headers({ origin: "https://evil.example" }), url), false);
  assert.equal(sameOriginWriteFromParts("POST", headers({ origin: "http://localhost:3000" }), url), true);
  assert.equal(sameOriginWriteFromParts("GET", headers({}), url), true);
});

test("worker secret and Bearer may omit Origin but cannot spoof a foreign Origin", () => {
  assert.equal(sameOriginWriteFromParts("POST", headers({ "x-autoseo-worker-secret": "secret" }), url), true);
  assert.equal(sameOriginWriteFromParts("POST", headers({ authorization: "Bearer abc" }), url), true);
  assert.equal(
    sameOriginWriteFromParts("POST", headers({ authorization: "Bearer abc", origin: "https://evil.example" }), url),
    false
  );
});

test("public API errors strip tokens, JSON dumps, and provider hosts", () => {
  assert.equal(publicErrorMessage(new Error("access_token=abc"), "Facebook failed."), "Facebook failed.");
  assert.equal(publicErrorMessage(new Error(`{"error":{"message":"secret"}}`), "Facebook failed."), "Facebook failed.");
  assert.equal(publicErrorMessage(new Error("graph.facebook.com blew up"), "Facebook failed."), "Facebook failed.");
  assert.equal(
    publicErrorMessage(
      new Error("Meta does not make demographic data available for this Page."),
      "Could not fetch insights."
    ),
    "Meta does not make demographic data available for this Page."
  );
});
