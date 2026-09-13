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
  if (!access.authenticated) return NextResponse.json({ jobs: [] });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const params = new URLSearchParams({
    workspace_id: `eq.${tenant.workspaceId}`,
    order: "created_at.desc",
    limit: "100",
  });
  if (status) params.set("status", `eq.${status}`);
  const jobs = await supabaseRest<UnknownRecord[]>(req, "jobs", {}, `?${params.toString()}`);
  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      attempts: j.attempts,
      maxAttempts: j.max_attempts,
      runAfter: j.run_after,
      lockedAt: j.locked_at,
      lastError: j.last_error,
      createdAt: j.created_at,
      updatedAt: j.updated_at,
    })),
  });
}
