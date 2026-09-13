import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getContentStrategy } from "@/lib/content-strategy-repository";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  if (!a.authenticated) return unauthorizedResponse();
  const p = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(p)) return p;
  const { id } = await params;
  const project = await getContentStrategy({ req, workspaceId: p.tenant.workspaceId }, id);
  if (!project) return NextResponse.json({ error: "Strategy project not found." }, { status: 404 });
  return NextResponse.json({ project });
}
