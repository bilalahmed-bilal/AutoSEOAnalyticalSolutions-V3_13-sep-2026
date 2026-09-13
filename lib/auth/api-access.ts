import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, type AuthUser } from "@/lib/auth/supabase";
import { sameOriginWrite } from "@/lib/security/request";
import { validateProductionSecurityConfig } from "@/lib/security/config";
import { isApiAuthRequired } from "@/lib/auth/policy";

export interface ApiAccess {
  user: AuthUser;
  authenticated: boolean;
}

/**
 * API authentication switch.
 *
 * Development defaults to false so the existing local demo keeps working.
 * Production always requires a verified session (`NODE_ENV=production`).
 * AUTOSEO_AUTH_REQUIRED=true also forces auth in development.
 */
export async function requireApiAccess(req: NextRequest): Promise<ApiAccess | null> {
  // Fail closed in production before any route-specific work occurs.
  validateProductionSecurityConfig();
  if (!sameOriginWrite(req)) return null;
  const authRequired = isApiAuthRequired();
  const user = await getAuthenticatedUser(req);

  if (user) return { user, authenticated: true };
  if (authRequired) return null;

  return { user: { id: "anonymous-local", email: "local@autoseo.local" }, authenticated: false };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}
