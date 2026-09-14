import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/supabase";
import { readAccessTokenFromRequest } from "@/lib/auth/session-cookie";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "auth-password");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many password attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  const user = await getAuthenticatedUser(req);
  if (!user)
    return NextResponse.json({ error: "Recovery session expired. Request a new reset email." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || readAccessTokenFromRequest(req);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return NextResponse.json({ error: "Authentication is unavailable." }, { status: 503 });
  const result = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password: body.password }),
  });
  const data = (await result.json().catch(() => ({}))) as Record<string, unknown>;
  if (!result.ok) {
    return NextResponse.json(
      { error: String(data.msg || data.message || "Password could not be updated.") },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
