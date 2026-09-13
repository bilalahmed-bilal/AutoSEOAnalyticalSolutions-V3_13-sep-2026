import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { createStudioProject, listStudioProjects } from "@/lib/content-studio-repository";
import { errorMessage } from "@/lib/unknown";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a?.authenticated) return unauthorizedResponse();
  const p = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(p)) return p;
  return NextResponse.json({ projects: await listStudioProjects({ req, workspaceId: p.tenant.workspaceId }) });
}
export async function POST(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a?.authenticated) return unauthorizedResponse();
  const p = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(p)) return p;
  try {
    const b = await req.json();
    if (!b.name?.trim()) return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    const project = await createStudioProject(
      { req, workspaceId: p.tenant.workspaceId },
      { name: String(b.name).trim(), strategyProjectId: b.strategyProjectId, createdBy: a.user?.id }
    );
    return NextResponse.json({ project }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Studio project create failed.") }, { status: 400 });
  }
}
