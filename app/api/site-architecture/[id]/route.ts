import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { getSiteArchitectureProject } from "@/lib/site-architecture/repository";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = await getTenantContext(req);
  if (!tenant) return Response.json({ error: "Workspace access required." }, { status: 403 });
  const { id } = await params;
  try {
    const project = await getSiteArchitectureProject({ req, workspaceId: tenant.workspaceId }, id);
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ project });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Unable to load project.") }, { status: 500 });
  }
}
