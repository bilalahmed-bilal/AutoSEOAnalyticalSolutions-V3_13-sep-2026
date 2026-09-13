import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { isRoleResult, requireWorkspaceRole } from "@/lib/auth/rbac";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { getTenantContext } from "@/lib/tenant";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ connections: [] });
  const permission = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });

  const rows = await supabaseRest<UnknownRecord[]>(
    req,
    "connections",
    {},
    `?workspace_id=eq.${encodeURIComponent(tenant.workspaceId)}&select=id,provider,display_name,status,last_checked_at,last_error,created_at,updated_at,token_expires_at&order=created_at.desc`
  );
  return NextResponse.json({
    connections: rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      displayName: row.display_name,
      status: row.status,
      lastCheckedAt: row.last_checked_at,
      lastError: row.last_error,
      connectedAt: row.created_at,
      updatedAt: row.updated_at,
      tokenExpiresAt: row.token_expires_at,
    })),
  });
}
