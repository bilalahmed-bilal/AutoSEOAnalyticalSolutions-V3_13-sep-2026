import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { createDraftVersionRemote, listDraftVersionsRemote } from "@/lib/store-repository";
import { buildInitialDecisions, normalizeSnapshot } from "@/lib/optimization/versioning";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req); if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ versions: [] });
  const permission = await requireWorkspaceRole(req, "viewer"); if (!isRoleResult(permission)) return permission;
  const draftId = new URL(req.url).searchParams.get("draftId"); if (!draftId) return NextResponse.json({ error: "draftId is required." }, { status: 400 });
  return NextResponse.json({ versions: await listDraftVersionsRemote({ req, workspaceId: permission.tenant.workspaceId }, draftId) });
}

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req); if (!access) return unauthorizedResponse();
  if (access.authenticated) { const permission = await requireWorkspaceRole(req, "editor"); if (!isRoleResult(permission)) return permission; }
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  try {
    const body = await req.json() as { draftId?: string; original?: Partial<Record<string,string>>; optimized?: Partial<Record<string,string>>; changes?: string[]; warnings?: string[] };
    if (!body.draftId || !body.original || !body.optimized) return NextResponse.json({ error: "draftId, original and optimized are required." }, { status: 400 });
    const original = normalizeSnapshot(body.original); const optimized = normalizeSnapshot(body.optimized);
    const decisions = buildInitialDecisions(original, optimized);
    const version = await createDraftVersionRemote({ req, workspaceId: tenant.workspaceId }, { draftId: body.draftId, original: { ...original }, optimized: { ...optimized }, decisions, warnings: body.warnings ?? [], createdBy: access.user?.id });
    return NextResponse.json({ version });
  } catch (err: any) { return NextResponse.json({ error: err?.message || "Version create failed." }, { status: 400 }); }
}
