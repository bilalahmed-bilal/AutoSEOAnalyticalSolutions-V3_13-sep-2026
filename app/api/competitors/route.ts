import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { listCompetitorProjects, createCompetitorProject } from "@/lib/competitor-repository";
import { analyzeCompetitors } from "@/lib/competitor-intelligence";
import { getKeywordResearch, listKeywordOpportunities } from "@/lib/keyword-research-repository";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  if (!a.authenticated) return NextResponse.json({ projects: [] });
  const p = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(p)) return p;
  return NextResponse.json({ projects: await listCompetitorProjects({ req, workspaceId: p.tenant.workspaceId }) });
}
export async function POST(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a?.authenticated) return unauthorizedResponse();
  const p = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(p)) return p;
  const b = await req.json();
  const target = String(b.targetUrl || "").trim();
  const urls = [...(b.competitorUrls || [])]
    .map(String)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!target || urls.length === 0)
    return NextResponse.json({ error: "targetUrl and at least one competitorUrl are required." }, { status: 400 });
  let ops: UnknownRecord[] = [];
  if (b.keywordProjectId) {
    const kp = await getKeywordResearch({ req, workspaceId: p.tenant.workspaceId }, String(b.keywordProjectId));
    if (!kp) return NextResponse.json({ error: "Keyword research project not found." }, { status: 404 });
    ops = await listKeywordOpportunities({ req, workspaceId: p.tenant.workspaceId }, kp.id);
  }
  try {
    const analysis = await analyzeCompetitors(target, urls, ops, 12);
    const project = await createCompetitorProject(
      { req, workspaceId: p.tenant.workspaceId },
      {
        name: String(b.name || "Competitor analysis").trim(),
        targetUrl: target,
        competitorUrls: urls,
        keywordProjectId: b.keywordProjectId ? String(b.keywordProjectId) : undefined,
        status: "ready",
        summary: analysis.summary,
        analysis,
      }
    );
    return NextResponse.json({ project }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Competitor analysis failed.") }, { status: 400 });
  }
}
