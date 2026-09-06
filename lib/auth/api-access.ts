import { NextRequest } from "next/server";
import { getAuthenticatedUser, type AuthUser } from "@/lib/auth/supabase";
import { sameOriginWrite } from "@/lib/security/request";

export interface ApiAccess {
  user: AuthUser;
  authenticated: boolean;
}

/**
 * API authentication switch.
 *
 * Development defaults to false so the existing local demo keeps working.
 * Production should set AUTOSEO_AUTH_REQUIRED=true; every protected route
 * then requires a verified Supabase bearer token.
 */
export async function requireApiAccess(req: NextRequest): Promise<ApiAccess | null> {
  if (!sameOriginWrite(req)) return null;
  const authRequired = process.env.AUTOSEO_AUTH_REQUIRED === "true";
  const user = await getAuthenticatedUser(req);

  if (user) return { user, authenticated: true };
  if (authRequired) return null;

  return { user: { id: "anonymous-local", email: "local@autoseo.local" }, authenticated: false };
}

export function unauthorizedResponse() {
  return Response.json(
    { error: "Authentication required. Supabase access token bhejein." },
    { status: 401 }
  );
}
