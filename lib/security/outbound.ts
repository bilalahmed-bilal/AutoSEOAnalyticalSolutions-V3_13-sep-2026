import { assertSafeUrl } from "@/lib/security/url-safety";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2_000_000;

export async function safeOutboundFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = await assertSafeUrl(rawUrl);
  const timeout = init.signal ?? AbortSignal.timeout(15_000);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      signal: timeout,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The destination returned an invalid redirect.");
      if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects.");
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) throw new Error("The destination response is too large.");
    return response;
  }

  throw new Error("Unable to safely reach the destination URL.");
}
