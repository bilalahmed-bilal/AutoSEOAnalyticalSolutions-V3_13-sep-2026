import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { listPublicationHistory } from "@/lib/rollback/history";

export async function GET(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ history: [] });
  const permission = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Workspace required." }, { status: 400 });
  return NextResponse.json({ history: await listPublicationHistory(tenant.workspaceId, (await params).draftId) });
}
