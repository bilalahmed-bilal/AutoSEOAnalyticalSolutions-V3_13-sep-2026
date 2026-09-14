type HeaderReader = { get(name: string): string | null };

function originMatches(requestUrl: string, origin: string): boolean {
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Cookie-authenticated browser writes must send a matching Origin.
 * Worker secret / Bearer may omit Origin, but a supplied Origin must match.
 */
export function sameOriginWriteFromParts(method: string, headers: HeaderReader, requestUrl: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return true;
  const hasWorker = Boolean(headers.get("x-autoseo-worker-secret"));
  const hasBearer = Boolean(headers.get("authorization")?.startsWith("Bearer "));
  const origin = headers.get("origin");

  if (hasWorker || hasBearer) {
    if (!origin) return true;
    return originMatches(requestUrl, origin);
  }

  if (!origin) return false;
  return originMatches(requestUrl, origin);
}
