import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult, type WorkspaceRole } from "@/lib/auth/rbac";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { refreshConnectionIfNeeded } from "@/lib/oauth/lifecycle";
import { evaluateFeature } from "@/lib/billing/entitlements";
import { entitlementResponse } from "@/lib/billing/access";
import { type FeatureKey } from "@/lib/product/features";

export type FacebookSecurityContext = {
  req: NextRequest;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  settings: { pageId: string; pageAccessToken: string; pageName?: string; permission?: "off" | "suggest" | "auto" };
  connectionId: string;
};

export async function requireFacebookAccess(
  req: NextRequest,
  minimumRole: WorkspaceRole = "viewer",
  feature: FeatureKey = "facebook.connect"
): Promise<FacebookSecurityContext | NextResponse> {
  const api = await requireApiAccess(req);
  if (!api) return unauthorizedResponse();
  const result = await requireWorkspaceRole(req, minimumRole);
  if (!isRoleResult(result)) return result;
  const entitled = await evaluateFeature(result.tenant.workspaceId, feature);
  if (!entitled.allowed) return entitlementResponse(entitled);

  const rows = await supabaseRest<
    Array<{
      id: string;
      provider: string;
      encrypted_credentials: string;
      status: string;
      token_expires_at?: string | null;
    }>
  >(
    req,
    "connections",
    {},
    `?workspace_id=eq.${encodeURIComponent(result.tenant.workspaceId)}&provider=eq.facebook&status=neq.revoked&select=id,provider,encrypted_credentials,status,token_expires_at&limit=1`
  );

  const connection = rows[0];
  if (!connection) {
    return NextResponse.json({ error: "Facebook connection is required for this action." }, { status: 400 });
  }

  try {
    const credentials = await refreshConnectionIfNeeded({
      ...connection,
      provider: connection.provider || "facebook",
    });
    if (!credentials.pageId || !credentials.pageAccessToken) throw new Error("Facebook Page credentials missing.");
    return {
      req,
      workspaceId: result.tenant.workspaceId,
      userId: result.tenant.user.id,
      role: result.role,
      settings: {
        pageId: String(credentials.pageId),
        pageAccessToken: String(credentials.pageAccessToken),
        pageName: credentials.pageName,
        permission: credentials.permission,
      },
      connectionId: connection.id,
    };
  } catch {
    return NextResponse.json(
      { error: "Facebook connection is invalid or expired. Please reconnect Facebook." },
      { status: 401 }
    );
  }
}

export function isFacebookSecurityContext(value: unknown): value is FacebookSecurityContext {
  return Boolean(value && typeof value === "object" && "workspaceId" in value && "settings" in value);
}
