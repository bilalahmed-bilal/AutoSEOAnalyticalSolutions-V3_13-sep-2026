import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies } from "@/lib/auth/session-cookie";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "auth-session");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many authentication attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (body.password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const result = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });
  const data = (await result.json().catch(() => ({}))) as Record<string, unknown>;
  if (!result.ok) {
    return NextResponse.json(
      { error: String(data.msg || data.message || "Signup failed.") },
      { status: result.status }
    );
  }
  const user = (data.user || data) as { id?: string; email?: string };
  const payload = {
    user: user.id ? { id: user.id, email: user.email } : null,
    sessionEstablished: Boolean(data.access_token),
    expires_at: data.expires_at,
  };
  const res = NextResponse.json(payload);
  if (data.access_token) {
    return applySessionCookies(res, {
      access_token: String(data.access_token),
      refresh_token: data.refresh_token ? String(data.refresh_token) : null,
      expires_in: Number(data.expires_in || 3600),
    });
  }
  return res;
}
