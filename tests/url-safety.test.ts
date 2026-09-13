import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSafeUrl, isPrivateIp } from "../lib/security/url-safety.ts";

async function rejects(url: string) {
  await assert.rejects(() => assertSafeUrl(url));
}

test("rejects localhost hostnames", async () => {
  await rejects("http://localhost/");
  await rejects("https://app.localhost/webhook");
});

test("rejects loopback IPv4 and IPv6", async () => {
  await rejects("http://127.0.0.1/");
  await rejects("http://127.0.0.1:80/webhook");
  await rejects("http://[::1]/");
});

test("rejects IPv4-mapped loopback and private addresses", async () => {
  await rejects("http://[::ffff:127.0.0.1]/");
  await rejects("http://[::ffff:10.0.0.1]/");
  await rejects("http://[::ffff:192.168.1.1]/");
  assert.equal(isPrivateIp("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateIp("::ffff:7f00:1"), true);
  assert.equal(isPrivateIp("::ffff:8.8.8.8"), false);
});

test("rejects private, link-local, CGNAT, and metadata IPv4", async () => {
  await rejects("http://10.0.0.1/");
  await rejects("http://192.168.1.1/");
  await rejects("http://172.16.0.1/");
  await rejects("http://169.254.169.254/");
  await rejects("http://100.64.0.1/");
  assert.equal(isPrivateIp("169.254.169.254"), true);
  assert.equal(isPrivateIp("8.8.8.8"), false);
});

test("rejects private IPv6, link-local, and unique-local", async () => {
  await rejects("http://[fe80::1]/");
  await rejects("http://[fd12:3456:789a::1]/");
  await rejects("http://[fc00::1]/");
});

test("rejects metadata hostnames, credentials, odd ports, and bad schemes", async () => {
  await rejects("http://metadata.google.internal/");
  await rejects("http://host.docker.internal/");
  await rejects("http://user:pass@example.com/");
  await rejects("http://example.com:8080/");
  await rejects("ftp://example.com/");
  await rejects("javascript:alert(1)");
  await rejects("https://");
});

test("publisher-style destinations are blocked before any outbound fetch", async () => {
  const blocked = [
    "http://127.0.0.1/webhook",
    "http://localhost/api/autoseo-publish",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://10.0.0.5/hook",
    "http://127.0.0.1",
  ];
  for (const url of blocked) {
    await rejects(url);
  }
});
