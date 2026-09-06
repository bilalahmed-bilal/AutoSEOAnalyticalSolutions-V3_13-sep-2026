import { accessToken } from "@/lib/auth/browser";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined") {
    const workspaceId = window.localStorage.getItem("autoseo.workspaceId");
    const token = accessToken();
    if (workspaceId) headers.set("x-workspace-id", workspaceId);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
