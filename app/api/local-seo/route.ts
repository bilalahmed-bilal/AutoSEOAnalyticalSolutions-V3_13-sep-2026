import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { listKeywordOpportunities } from "@/lib/keyword-research-repository";
import { analyzeLocalSeo } from "@/lib/local-seo/engine";
import { createLocalSeoProject, listLocalSeoProjects } from "@/lib/local-seo/repository";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = await getTenantContext(req);
  if (!tenant) return Response.json({ error: "Workspace access required." }, { status: 403 });
  try {
    return Response.json({ projects: await listLocalSeoProjects({ req, workspaceId: tenant.workspaceId }) });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Unable to load local SEO projects.") }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = await getTenantContext(req);
  if (!tenant) return Response.json({ error: "Workspace access required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.url !== "string" || !body.url.trim() || typeof body.location !== "string" || !body.location.trim())
    return Response.json({ error: "url and location are required." }, { status: 400 });
  try {
    let keywords: UnknownRecord[] = [];
    if (typeof body.keywordProjectId === "string" && body.keywordProjectId)
      keywords = await listKeywordOpportunities({ req, workspaceId: tenant.workspaceId }, body.keywordProjectId);
    const analysis = await analyzeLocalSeo(
      body.url.trim(),
      body.location.trim(),
      typeof body.businessName === "string" ? body.businessName.trim() : undefined,
      keywords,
      Number(body.maxPages) || 25
    );
    const saved = await createLocalSeoProject(
      { req, workspaceId: tenant.workspaceId },
      {
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name.trim()
            : `Local SEO — ${new URL(body.url.trim()).hostname} — ${body.location.trim()}`,
        targetUrl: analysis.site.startUrl,
        location: analysis.location,
        businessName: analysis.businessName,
        keywordProjectId: body.keywordProjectId,
        summary: analysis.summary,
        analysis,
        createdBy: access.user.id,
      }
    );
    return Response.json({ project: saved });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Local SEO analysis failed.") }, { status: 400 });
  }
}
