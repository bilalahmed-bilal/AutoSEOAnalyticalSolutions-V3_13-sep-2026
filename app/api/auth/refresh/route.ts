import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies, clearSessionCookies, readRefreshTokenFromRequest } from "@/lib/auth/session-cookie";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "auth-session");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many authentication attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  const refresh = readRefreshTokenFromRequest(req);
  if (!refresh) return clearSessionCookies(NextResponse.json({ error: "No refresh session." }, { status: 401 }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const result = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
    cache: "no-store",
  });
  const data = (await result.json().catch(() => ({}))) as Record<string, unknown>;
  if (!result.ok || !data.access_token) {
    return clearSessionCookies(NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 }));
  }
  const user = (data.user || {}) as { id?: string; email?: string };
  const res = NextResponse.json({
    user: user.id ? { id: user.id, email: user.email } : null,
    expires_at: data.expires_at,
  });
  return applySessionCookies(res, {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token ? String(data.refresh_token) : refresh,
    expires_in: Number(data.expires_in || 3600),
  });
}
