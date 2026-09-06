import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2_000_000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0 ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("ff")
  );
}

export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

async function assertSafeHostname(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Local/private hosts are not allowed.");
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private or reserved IP addresses are not allowed.");
    return;
  }

  const addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("The target resolves to a private or reserved network address.");
  }
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const normalized = rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`;
  const url = new URL(normalized);
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new Error("Only HTTP(S) URLs are allowed.");
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Only standard HTTP/HTTPS ports are allowed.");
  }
  await assertSafeHostname(url.hostname);
  return url;
}

async function readLimitedBody(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("The page is too large to analyze.");

  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("The page is too large to analyze.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function safeFetchPage(rawUrl: string): Promise<{ url: string; response: Response; html: string }> {
  let current = await assertSafeUrl(rawUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": "AutoSEO-Bot/2.0 (+https://autoseo.example)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The website returned an invalid redirect.");
      if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects.");
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`Page fetch failed with status ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error("The target URL did not return an HTML page.");
    }
    const html = await readLimitedBody(response);
    return { url: current.toString(), response, html };
  }

  throw new Error("Unable to safely fetch the page.");
}
