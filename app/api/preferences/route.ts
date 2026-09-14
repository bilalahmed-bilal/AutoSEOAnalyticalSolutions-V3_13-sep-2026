import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/supabase";
import { readAccessTokenFromRequest } from "@/lib/auth/session-cookie";
import { DEFAULT_LANGUAGE_CODE, UI_LANGUAGE_COOKIE, enabledLanguages, isLanguageEnabled } from "@/lib/i18n/registry";
import { resolveUiLanguage } from "@/lib/i18n/resolve";
import { isThemeMode, parseThemeMode, THEME_COOKIE, type ThemeMode } from "@/lib/theme/preference";

export const runtime = "nodejs";

function languageCookie(code: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${UI_LANGUAGE_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function themeCookie(mode: ThemeMode) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${THEME_COOKIE}=${encodeURIComponent(mode)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

async function readUserMetadata(req: NextRequest): Promise<{ ui_language?: string; theme?: string } | null> {
  const token =
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() || readAccessTokenFromRequest(req);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { user_metadata?: { ui_language?: string; theme?: string } };
  return user.user_metadata || null;
}

async function saveUserMetadata(req: NextRequest, data: Record<string, string>) {
  const token =
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() || readAccessTokenFromRequest(req);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return;
  await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  }).catch(() => undefined);
}

export async function GET(req: NextRequest) {
  const cookieLang = req.cookies.get(UI_LANGUAGE_COOKIE)?.value || null;
  const cookieTheme = req.cookies.get(THEME_COOKIE)?.value || null;
  const user = await getAuthenticatedUser(req);
  const meta = user ? await readUserMetadata(req) : null;
  const resolved = resolveUiLanguage({ userLanguage: meta?.ui_language || null, storedLanguage: cookieLang });
  const theme = parseThemeMode(meta?.theme || cookieTheme);
  return NextResponse.json({
    uiLanguage: resolved.code,
    locale: resolved.locale,
    direction: resolved.direction,
    theme,
    enabled: enabledLanguages().map((item) => item.code),
    defaultLanguage: DEFAULT_LANGUAGE_CODE,
    contentLanguageIndependent: true,
  });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { uiLanguage?: string; theme?: string };
  const user = await getAuthenticatedUser(req);
  const res = NextResponse.json({ ok: true });
  const metadata: Record<string, string> = {};

  let languageCode = req.cookies.get(UI_LANGUAGE_COOKIE)?.value || DEFAULT_LANGUAGE_CODE;
  if (body.uiLanguage !== undefined) {
    const requested = String(body.uiLanguage || "")
      .trim()
      .toLowerCase();
    languageCode = isLanguageEnabled(requested) ? requested : DEFAULT_LANGUAGE_CODE;
    metadata.ui_language = languageCode;
    res.headers.append("Set-Cookie", languageCookie(languageCode));
  }

  let themeMode = parseThemeMode(req.cookies.get(THEME_COOKIE)?.value);
  if (body.theme !== undefined) {
    themeMode = isThemeMode(body.theme) ? body.theme : "system";
    metadata.theme = themeMode;
    res.headers.append("Set-Cookie", themeCookie(themeMode));
  }

  if (user && Object.keys(metadata).length) {
    const existing = (await readUserMetadata(req)) || {};
    await saveUserMetadata(req, {
      ui_language: metadata.ui_language || existing.ui_language || languageCode,
      theme: metadata.theme || existing.theme || themeMode,
    });
  }
  const resolved = resolveUiLanguage({
    userLanguage: user && metadata.ui_language ? metadata.ui_language : null,
    storedLanguage: languageCode,
  });
  return NextResponse.json(
    {
      uiLanguage: resolved.code,
      locale: resolved.locale,
      direction: resolved.direction,
      theme: themeMode,
      persisted: user ? "user" : "cookie",
    },
    { headers: res.headers }
  );
}
