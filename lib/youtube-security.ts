import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult, type WorkspaceRole } from "@/lib/auth/rbac";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { refreshConnectionIfNeeded } from "@/lib/oauth/lifecycle";
import { evaluateFeature } from "@/lib/billing/entitlements";
import { entitlementResponse } from "@/lib/billing/access";
import { type FeatureKey } from "@/lib/product/features";

export type YouTubeSecurityContext = {
  req: NextRequest;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  settings: { accessToken: string; permission?: "off" | "suggest" | "auto"; scope?: string };
  connectionId: string;
};

export async function requireYouTubeAccess(
  req: NextRequest,
  minimumRole: WorkspaceRole = "viewer",
  feature: FeatureKey = "youtube.connect"
): Promise<YouTubeSecurityContext | NextResponse> {
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
    `?workspace_id=eq.${encodeURIComponent(result.tenant.workspaceId)}&provider=eq.youtube&status=neq.revoked&select=id,provider,encrypted_credentials,status,token_expires_at&limit=1`
  );

  const connection = rows[0];
  if (!connection) {
    return NextResponse.json({ error: "YouTube connection is required for this action." }, { status: 400 });
  }

  try {
    const credentials = await refreshConnectionIfNeeded({
      ...connection,
      provider: connection.provider || "youtube",
    });
    if (!credentials.accessToken) throw new Error("YouTube access token missing.");
    return {
      req,
      workspaceId: result.tenant.workspaceId,
      userId: result.tenant.user.id,
      role: result.role,
      settings: {
        accessToken: String(credentials.accessToken),
        permission: credentials.permission,
        ...(typeof credentials.scope === "string" ? { scope: credentials.scope } : {}),
      },
      connectionId: connection.id,
    };
  } catch {
    return NextResponse.json(
      { error: "YouTube connection is invalid or expired. Please reconnect YouTube." },
      { status: 401 }
    );
  }
}

export function isYouTubeSecurityContext(value: unknown): value is YouTubeSecurityContext {
  return Boolean(value && typeof value === "object" && "workspaceId" in value && "settings" in value);
}
