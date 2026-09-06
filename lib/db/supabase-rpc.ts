import { NextRequest } from "next/server";

function baseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  return url.replace(/\/$/, "");
}

export async function supabaseRpc<T>(req: NextRequest, fn: string, args: Record<string, unknown> = {}) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !key) throw new Error("Authentication required for Supabase RPC.");
  const response = await fetch(`${baseUrl()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase RPC ${response.status}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
