import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getKeywordResearch, listKeywordOpportunities } from "@/lib/keyword-research-repository";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return unauthorizedResponse();
  const p = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(p)) return p;
  const { id } = await params;
  const project = await getKeywordResearch({ req, workspaceId: p.tenant.workspaceId }, id);
  if (!project) return NextResponse.json({ error: "Keyword research project not found." }, { status: 404 });
  return NextResponse.json({
    project,
    opportunities: await listKeywordOpportunities({ req, workspaceId: p.tenant.workspaceId }, id),
  });
}
