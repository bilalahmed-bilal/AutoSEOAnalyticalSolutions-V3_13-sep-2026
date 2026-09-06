import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { createOAuthState } from "@/lib/oauth/state";
import { authorizationUrl } from "@/lib/oauth/provider";
import type { OAuthProvider } from "@/lib/oauth/config";

const providers = new Set<OAuthProvider>(["google-youtube", "google-search-console", "facebook"]);
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ error: "OAuth requires authenticated Supabase mode." }, { status: 401 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const { provider } = await params;
  if (!providers.has(provider as OAuthProvider)) return NextResponse.json({ error: "Unsupported OAuth provider." }, { status: 404 });
  try {
    const state = await createOAuthState(provider as OAuthProvider, tenant.workspaceId, tenant.user.id);
    return NextResponse.json({ url: authorizationUrl(provider as OAuthProvider, state) });
  } catch (e: any) { return NextResponse.json({ error: e?.message || "OAuth configuration incomplete." }, { status: 500 }); }
}
