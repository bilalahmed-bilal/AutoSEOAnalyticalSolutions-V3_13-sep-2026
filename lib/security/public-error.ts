import { NextRequest, NextResponse } from "next/server";
import { publicErrorMessage } from "@/lib/security/public-message";

export { publicErrorMessage };

export function jsonPublicError(err: unknown, fallback: string, status = 500) {
  console.error(fallback, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: publicErrorMessage(err, fallback) }, { status });
}

export async function readJsonBody<T>(
  req: NextRequest,
  maxBytes = 256_000
): Promise<{ ok: true; value: T } | { ok: false; response: NextResponse }> {
  const headerLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(headerLength) && headerLength > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  }
  if (!text.trim()) return { ok: true, value: {} as T };
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }
}
