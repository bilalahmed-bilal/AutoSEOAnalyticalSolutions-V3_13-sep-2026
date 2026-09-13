import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { listKeywordOpportunities } from "@/lib/keyword-research-repository";
import { analyzeSiteArchitecture } from "@/lib/site-architecture/engine";
import { createSiteArchitectureProject, listSiteArchitectureProjects } from "@/lib/site-architecture/repository";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = await getTenantContext(req);
  if (!tenant) return Response.json({ error: "Workspace access required." }, { status: 403 });
  try {
    return Response.json({ projects: await listSiteArchitectureProjects({ req, workspaceId: tenant.workspaceId }) });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Unable to load architecture projects.") }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = await getTenantContext(req);
  if (!tenant) return Response.json({ error: "Workspace access required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.url !== "string" || !body.url.trim())
    return Response.json({ error: "url is required." }, { status: 400 });
  try {
    let keywords: UnknownRecord[] = [];
    if (typeof body.keywordProjectId === "string" && body.keywordProjectId) {
      keywords = await listKeywordOpportunities({ req, workspaceId: tenant.workspaceId }, body.keywordProjectId);
    }
    const analysis = await analyzeSiteArchitecture(body.url.trim(), keywords, Number(body.maxPages) || 30);
    const saved = await createSiteArchitectureProject(
      { req, workspaceId: tenant.workspaceId },
      {
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name.trim()
            : `Site Architecture — ${new URL(body.url.trim()).hostname}`,
        targetUrl: analysis.site.startUrl,
        keywordProjectId: body.keywordProjectId,
        summary: analysis.summary,
        analysis,
        createdBy: access.user.id,
      }
    );
    return Response.json({ project: saved });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Site architecture analysis failed.") }, { status: 400 });
  }
}
