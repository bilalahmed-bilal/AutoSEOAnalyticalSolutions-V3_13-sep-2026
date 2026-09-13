import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { getTenantContext, type TenantContext } from "@/lib/tenant";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
const rank: Record<WorkspaceRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export async function getWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  const rows = await supabaseAdmin<Array<{ role: WorkspaceRole }>>(
    "workspace_members",
    {},
    `?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`
  );
  return rows[0]?.role ?? null;
}

export async function requireWorkspaceRole(
  req: NextRequest,
  minimum: WorkspaceRole
): Promise<{ tenant: TenantContext; role: WorkspaceRole } | NextResponse> {
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid authenticated workspace required." }, { status: 401 });
  const role = await getWorkspaceRole(tenant.workspaceId, tenant.user.id);
  if (!role || rank[role] < rank[minimum]) {
    return NextResponse.json({ error: `Workspace ${minimum} permission required.` }, { status: 403 });
  }
  return { tenant, role };
}

export function isRoleResult(value: unknown): value is { tenant: TenantContext; role: WorkspaceRole } {
  return Boolean(value && typeof value === "object" && "tenant" in value && "role" in value);
}
