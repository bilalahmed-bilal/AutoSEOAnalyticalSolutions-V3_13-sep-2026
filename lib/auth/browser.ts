const STORAGE_KEY = "autoseo.supabase.session";

type Session = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { id: string; email?: string };
  cookieSession?: boolean;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and anon key are not configured.");
  return { url: url.replace(/\/$/, ""), key };
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function setSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("autoseo-auth-change"));
}

function publicSession(user?: { id?: string; email?: string | null }, expiresAt?: number): Session {
  return {
    cookieSession: true,
    expires_at: expiresAt,
    user: user?.id ? { id: user.id, email: user.email || undefined } : undefined,
  };
}

export function accessToken() {
  return getSession()?.access_token || null;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  return fetch(`${url}/auth/v1/${path}`, { ...init, headers });
}

async function establishCookieSession(payload: Record<string, unknown>) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.error_description || data.msg || "Authentication failed.");
  setSession(publicSession(data.user, data.expires_at));
  return data;
}

export async function signIn(email: string, password: string) {
  return establishCookieSession({ email, password });
}

export async function signUp(email: string, password: string) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.msg || data.message || "Signup failed.");
  if (data.user?.id && data.sessionEstablished) setSession(publicSession(data.user, data.expires_at));
  return data;
}

export async function resetPassword(email: string) {
  const redirectTo = `${window.location.origin}/auth/reset`;
  const res = await authFetch("recover", { method: "POST", body: JSON.stringify({ email, redirect_to: redirectTo }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || "Password reset email could not be sent.");
}

export async function updatePassword(password: string) {
  const res = await fetch("/api/auth/password", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}),
    },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.msg || data.message || "Password could not be updated.");
}

export async function signOut() {
  try {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
  } catch {
    /* still clear local marker */
  }
  setSession(null);
}

export async function refreshSession() {
  const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
  if (!res.ok) {
    const current = getSession();
    if (current?.refresh_token) {
      const fallback = await authFetch("token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      if (!fallback.ok) {
        setSession(null);
        return null;
      }
      const data = await fallback.json();
      await establishCookieSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token || current.refresh_token,
      }).catch(() => {
        setSession(null);
      });
      return getSession();
    }
    setSession(null);
    return null;
  }
  const data = await res.json();
  setSession(publicSession(data.user, data.expires_at));
  return data;
}

export async function loadCurrentUser() {
  const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
  if (res.ok) {
    const data = await res.json();
    if (data.authenticated && data.user) {
      const current = getSession();
      if (!current?.cookieSession || current.user?.id !== data.user.id) {
        setSession(publicSession(data.user, current?.expires_at));
      }
      return data.user;
    }
  }
  if (res.status === 401 && getSession()) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retry = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (retry.ok) {
        const data = await retry.json();
        return data.user || null;
      }
    }
    return null;
  }
  const token = accessToken();
  if (!token) return null;
  const { url, key } = config();
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (userRes.ok) return userRes.json();
  if (userRes.status === 401) return refreshSession().then((s) => s?.user || null);
  return null;
}

export async function adoptRecoveryTokens(access: string, refresh: string, expiresAt?: number) {
  await establishCookieSession({ access_token: access, refresh_token: refresh, expires_at: expiresAt });
}
