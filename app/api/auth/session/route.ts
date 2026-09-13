import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies, clearSessionCookies } from "@/lib/auth/session-cookie";
import { checkRateLimit } from "@/lib/security/rate-limit";

function supabaseAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url, key };
}

async function supabaseToken(path: string, body: unknown) {
  const { url, key } = supabaseAuth();
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

function userFromTokenPayload(data: Record<string, unknown>) {
  const user = (data.user || {}) as { id?: string; email?: string };
  return user.id ? { id: user.id, email: user.email } : null;
}

function rateLimited(req: NextRequest) {
  const rate = checkRateLimit(req, "auth-session");
  if (rate.ok) return null;
  return NextResponse.json(
    { error: "Too many authentication attempts. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
  );
}

export async function POST(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };

  try {
    if (body.access_token) {
      const { url, key } = supabaseAuth();
      const userRes = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${body.access_token}` },
        cache: "no-store",
      });
      if (!userRes.ok) return NextResponse.json({ error: "Invalid session token." }, { status: 401 });
      const user = (await userRes.json()) as { id?: string; email?: string };
      const res = NextResponse.json({
        user: user.id ? { id: user.id, email: user.email } : null,
        expires_at: body.expires_at,
      });
      return applySessionCookies(res, {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
    }

    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    const result = await supabaseToken("token?grant_type=password", {
      email: body.email,
      password: body.password,
    });
    if (!result.ok || !result.data.access_token) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    const res = NextResponse.json({
      user: userFromTokenPayload(result.data),
      expires_at: result.data.expires_at,
    });
    return applySessionCookies(res, {
      access_token: String(result.data.access_token),
      refresh_token: result.data.refresh_token ? String(result.data.refresh_token) : null,
      expires_in: Number(result.data.expires_in || 3600),
    });
  } catch {
    return NextResponse.json({ error: "Authentication is unavailable." }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
  try {
    const { url, key } = supabaseAuth();
    const access = token || req.cookies.get("nexora_sb_access")?.value;
    if (access) {
      await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${access}` },
      }).catch(() => undefined);
    }
  } catch {
    /* still clear cookies */
  }
  return clearSessionCookies(NextResponse.json({ ok: true }));
}
