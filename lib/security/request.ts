import { NextRequest } from "next/server";

/** Reject cross-origin browser writes. Server-to-server workers/cron may omit Origin. */
export function sameOriginWrite(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  if (req.headers.get("x-autoseo-worker-secret") || req.headers.get("authorization")?.startsWith("Bearer ")) {
    const origin = req.headers.get("origin");
    if (!origin) return true;
    try { return new URL(origin).origin === new URL(req.url).origin; } catch { return false; }
  }
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(req.url).origin; } catch { return false; }
}
