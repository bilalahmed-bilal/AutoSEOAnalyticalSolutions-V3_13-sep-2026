import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "viewer");
    if (!isRoleResult(permission)) return permission;
  }
  if (!access.authenticated) return NextResponse.json({ logs: [] });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const rows = await supabaseRest<UnknownRecord[]>(
    req,
    "audit_logs",
    {},
    `?workspace_id=eq.${tenant.workspaceId}&select=id,actor_user_id,action,entity_type,entity_id,metadata,created_at&order=created_at.desc&limit=100`
  );
  return NextResponse.json({ logs: rows });
}
