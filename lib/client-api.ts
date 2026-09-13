import { accessToken, getSession, refreshSession } from "@/lib/auth/browser";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined") {
    const workspaceId = window.localStorage.getItem("autoseo.workspaceId");
    const token = accessToken();
    if (workspaceId) headers.set("x-workspace-id", workspaceId);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const request = () => fetch(input, { ...init, headers, credentials: "include" });
  let res = await request();
  if (res.status === 401 && typeof window !== "undefined" && getSession()) {
    const refreshed = await refreshSession();
    if (refreshed) res = await request();
  }
  return res;
}
