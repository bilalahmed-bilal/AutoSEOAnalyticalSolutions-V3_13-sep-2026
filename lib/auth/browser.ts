const STORAGE_KEY = "autoseo.supabase.session";

type Session = { access_token: string; refresh_token: string; expires_at?: number; user?: { id: string; email?: string } };

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL aur anon key configured nahi hain.");
  return { url: url.replace(/\/$/, ""), key };
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}

export function setSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("autoseo-auth-change"));
}

export function accessToken() { return getSession()?.access_token || null; }

async function authFetch(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const headers = new Headers(init.headers);
  headers.set("apikey", key); headers.set("Content-Type", "application/json");
  return fetch(`${url}/auth/v1/${path}`, { ...init, headers });
}

export async function signIn(email: string, password: string) {
  const res = await authFetch("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "Login failed.");
  setSession(data); return data;
}

export async function signUp(email: string, password: string) {
  const res = await authFetch("signup", { method: "POST", body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.message || "Signup failed.");
  if (data.access_token) setSession(data);
  return data;
}

export async function resetPassword(email: string) {
  const redirectTo = `${window.location.origin}/auth/reset`;
  const res = await authFetch("recover", { method: "POST", body: JSON.stringify({ email, redirect_to: redirectTo }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || "Password reset email send nahi ho saki.");
}

export async function updatePassword(password: string) {
  const token = accessToken();
  if (!token) throw new Error("Recovery session expire ho chuki hai. Dobara reset email request karein.");
  const { url, key } = config();
  const res = await fetch(`${url}/auth/v1/user`, { method: "PUT", headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || "Password update nahi ho saka.");
}

export async function signOut() {
  const token = accessToken();
  if (token) { try { await authFetch("logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch {} }
  setSession(null);
}

export async function refreshSession() {
  const current = getSession();
  if (!current?.refresh_token) return null;
  const res = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: current.refresh_token }) });
  if (!res.ok) { setSession(null); return null; }
  const data = await res.json(); setSession(data); return data;
}

export async function loadCurrentUser() {
  const token = accessToken(); if (!token) return null;
  const { url, key } = config();
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.ok) return res.json();
  if (res.status === 401) return refreshSession().then((s) => s?.user || null);
  return null;
}
