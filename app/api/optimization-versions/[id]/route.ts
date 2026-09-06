import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { getDraftVersionRemote, updateDraftVersionRemote } from "@/lib/store-repository";
import type { ChangeDecision } from "@/lib/optimization/versioning";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req); if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ version: null });
  const permission = await requireWorkspaceRole(req, "viewer"); if (!isRoleResult(permission)) return permission;
  const version = await getDraftVersionRemote({ req, workspaceId: permission.tenant.workspaceId }, (await params).id);
  if (!version) return NextResponse.json({ error: "Version not found." }, { status: 404 });
  return NextResponse.json({ version });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req); if (!access) return unauthorizedResponse();
  if (!access.authenticated) return unauthorizedResponse();
  const permission = await requireWorkspaceRole(req, "editor"); if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req); if (!tenant) return NextResponse.json({ error: "Workspace required." }, { status: 400 });
  const id = (await params).id;
  const version = await getDraftVersionRemote({ req, workspaceId: tenant.workspaceId }, id);
  if (!version) return NextResponse.json({ error: "Version not found." }, { status: 404 });
  if (version.status !== "proposed") return NextResponse.json({ error: "Only proposed versions can be edited." }, { status: 409 });
  const body = await req.json() as { decisions?: ChangeDecision[]; status?: "rejected" };
  const patch: Record<string, unknown> = {};
  if (body.decisions) patch.change_decisions = body.decisions;
  if (body.status === "rejected") patch.status = "rejected";
  const updated = await updateDraftVersionRemote({ req, workspaceId: tenant.workspaceId }, id, patch);
  return NextResponse.json({ version: updated });
}
