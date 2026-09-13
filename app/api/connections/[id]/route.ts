import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { getTenantContext } from "@/lib/tenant";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const { id } = await params;
  await supabaseRest(
    req,
    "connections",
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "revoked",
        encrypted_credentials: "revoked",
        last_error: null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    },
    `?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(tenant.workspaceId)}`
  );
  return NextResponse.json({ ok: true });
}
