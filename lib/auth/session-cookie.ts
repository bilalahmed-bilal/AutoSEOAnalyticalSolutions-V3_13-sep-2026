import { NextRequest, NextResponse } from "next/server";

export const ACCESS_COOKIE = "nexora_sb_access";
export const REFRESH_COOKIE = "nexora_sb_refresh";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function readAccessTokenFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get(ACCESS_COOKIE)?.value?.trim();
  return cookie || null;
}

export function readRefreshTokenFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get(REFRESH_COOKIE)?.value?.trim();
  return cookie || null;
}

export function applySessionCookies(
  res: NextResponse,
  tokens: { access_token: string; refresh_token?: string | null; expires_in?: number }
) {
  const accessAge = Number.isFinite(Number(tokens.expires_in))
    ? Math.max(60, Number(tokens.expires_in))
    : ACCESS_MAX_AGE;
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(accessAge));
  if (tokens.refresh_token) {
    res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(REFRESH_MAX_AGE));
  }
  return res;
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return res;
}
