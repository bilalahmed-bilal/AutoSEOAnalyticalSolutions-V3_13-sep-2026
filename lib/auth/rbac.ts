import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { getTenantContext, type TenantContext } from "@/lib/tenant";
import { evaluateFeature } from "@/lib/billing/entitlements";
import { featureGateForPath } from "@/lib/billing/route-policy";

export type WorkspaceRole = "owner" | "admin" | "editor" | "member" | "viewer";
const rank: Record<WorkspaceRole, number> = { viewer: 1, member: 2, editor: 2, admin: 3, owner: 4 };

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
  const gate = featureGateForPath(req.nextUrl.pathname, req.method);
  if (gate) {
    const decision = await evaluateFeature(tenant.workspaceId, gate.feature);
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.reason, code: decision.code, feature: decision.feature, plan: decision.plan },
        { status: decision.statusCode }
      );
    }
  }
  return { tenant, role };
}

export function isRoleResult(value: unknown): value is { tenant: TenantContext; role: WorkspaceRole } {
  return Boolean(value && typeof value === "object" && "tenant" in value && "role" in value);
}
