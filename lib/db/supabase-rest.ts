import { NextRequest } from "next/server";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
}

export async function supabaseRest<T>(
  req: NextRequest,
  table: string,
  init: RequestInit = {},
  query = ""
): Promise<T> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required for database access.");
  const headers = new Headers(init.headers);
  headers.set("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl()}/rest/v1/${table}${query}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function supabaseAdmin<T>(table: string, init: RequestInit = {}, query = ""): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${table}${query}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase admin ${response.status}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
