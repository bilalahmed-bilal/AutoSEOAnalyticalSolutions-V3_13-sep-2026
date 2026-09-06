import { NextRequest } from "next/server";

export interface AuthUser {
  id: string;
  email?: string;
}

function getBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Verifies a Supabase access token by asking Supabase Auth for the user.
 * This intentionally avoids trusting unverified JWT payloads.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthUser | null> {
  const token = getBearer(req);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string; email?: string };
  return user.id ? { id: user.id, email: user.email } : null;
}

export async function requireAuthenticatedUser(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthenticatedUser(req);
  if (!user) throw new Error("Authentication required.");
  return user;
}
