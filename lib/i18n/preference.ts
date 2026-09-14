import {
  DEFAULT_LANGUAGE_CODE,
  UI_LANGUAGE_COOKIE,
  UI_LANGUAGE_STORAGE_KEY,
  WORKSPACE_LANGUAGE_STORAGE_PREFIX,
  isLanguageEnabled,
} from "./registry";
import { resolveUiLanguage } from "./resolve";

export function readStoredUiLanguage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readWorkspaceUiLanguage(workspaceId?: string | null): string | null {
  if (typeof window === "undefined" || !workspaceId) return null;
  try {
    return window.localStorage.getItem(`${WORKSPACE_LANGUAGE_STORAGE_PREFIX}${workspaceId}`);
  } catch {
    return null;
  }
}

export function readCookieUiLanguage(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${UI_LANGUAGE_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function persistUiLanguage(code: string, workspaceId?: string | null) {
  const next = isLanguageEnabled(code) ? code : DEFAULT_LANGUAGE_CODE;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
    if (workspaceId) window.localStorage.setItem(`${WORKSPACE_LANGUAGE_STORAGE_PREFIX}${workspaceId}`, next);
  }
  if (typeof document !== "undefined") {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${UI_LANGUAGE_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }
  return next;
}

export function resolvedBrowserUiLanguage(userLanguage?: string | null, workspaceId?: string | null) {
  return resolveUiLanguage({
    userLanguage,
    workspaceLanguage: readWorkspaceUiLanguage(workspaceId),
    storedLanguage: readStoredUiLanguage() || readCookieUiLanguage(),
  });
}
