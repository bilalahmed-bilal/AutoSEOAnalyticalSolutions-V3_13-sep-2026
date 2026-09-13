import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { isRoleResult, requireWorkspaceRole, type WorkspaceRole } from "@/lib/auth/rbac";

export async function requireChannelAccess(
  req: NextRequest,
  minimum: WorkspaceRole = "viewer"
): Promise<
  { tenant: { workspaceId: string; user: { id: string; email?: string | null } }; role: WorkspaceRole } | NextResponse
> {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const result = await requireWorkspaceRole(req, minimum);
  if (!isRoleResult(result)) return result;
  return result;
}
