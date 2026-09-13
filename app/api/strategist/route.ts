import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { buildStrategyPlan } from "@/lib/strategist/engine";
import { createStrategyRun, listStrategyRuns } from "@/lib/strategist/repository";
import { listTechnicalAudits } from "@/lib/technical-seo-repository";
import { listCompetitorProjects } from "@/lib/competitor-repository";
import { listContentStrategies } from "@/lib/content-strategy-repository";
import { listQualityReports } from "@/lib/content-quality-repository";
import { listSiteArchitectureProjects } from "@/lib/site-architecture/repository";
import { listLocalSeoProjects } from "@/lib/local-seo/repository";
import { listKeywordResearch } from "@/lib/keyword-research-repository";
import { listMonitoringProfiles, listMonitoringSnapshots } from "@/lib/monitoring/repository";
import { buildAdvancedAnalytics } from "@/lib/analytics/advanced";
import { explainStrategyWithAI } from "@/lib/strategist/ai";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

async function context(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a || !a.authenticated) return { error: unauthorizedResponse() };
  const t = await getTenantContext(req);
  if (!t) return { error: NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 }) };
  return { access: a, tenant: t };
}

export async function GET(req: NextRequest) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const runs = await listStrategyRuns(c.tenant.workspaceId);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const permission = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(permission)) return permission;
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = String(body.targetUrl || "").trim();
    if (!targetUrl) return NextResponse.json({ error: "targetUrl is required." }, { status: 400 });
    const ctx = { req, workspaceId: c.tenant.workspaceId };
    const [technical, competitors, strategies, quality, architecture, local, keywords, profiles] = await Promise.all([
      listTechnicalAudits(ctx),
      listCompetitorProjects(ctx),
      listContentStrategies(ctx),
      listQualityReports(ctx),
      listSiteArchitectureProjects(ctx),
      listLocalSeoProjects(ctx),
      listKeywordResearch(ctx),
      listMonitoringProfiles(ctx),
    ]);
    const matching = (rows: UnknownRecord[]) =>
      rows.find(
        (x: UnknownRecord) =>
          String(x.target_url || x.targetUrl || "").replace(/\/$/, "") === targetUrl.replace(/\/$/, "")
      ) || rows[0];
    const latestTech = matching(technical),
      latestComp = matching(competitors),
      latestArch = matching(architecture),
      latestLocal = matching(local),
      latestQuality = quality[0];
    const latestKeyword = keywords[0];
    let opportunityCount = 0;
    if (latestKeyword) {
      const { listKeywordOpportunities } = await import("@/lib/keyword-research-repository");
      opportunityCount = (await listKeywordOpportunities(ctx, latestKeyword.id)).length;
    }
    const profile = matching(profiles);
    let monitoring: UnknownRecord = null;
    if (profile) {
      const snaps = await listMonitoringSnapshots(c.tenant.workspaceId, profile.id);
      const latest = snaps[0];
      monitoring = { alertCount: Array.isArray(latest?.alerts) ? latest.alerts.length : 0 };
    }
    let analytics: UnknownRecord = null;
    try {
      const a = await buildAdvancedAnalytics(req, c.tenant.workspaceId);
      const cur = a.traffic.current,
        prev = a.traffic.previous;
      analytics = {
        clicksDeltaPct: prev && prev.clicks ? ((cur.clicks - prev.clicks) / prev.clicks) * 100 : null,
        positionDelta: a.traffic.delta?.averagePosition ?? null,
      };
    } catch {}
    const plan = buildStrategyPlan({
      technical: latestTech ? { score: latestTech.score } : null,
      architecture: latestArch
        ? { score: latestArch.summary?.architectureScore ?? latestArch.analysis?.summary?.architectureScore }
        : null,
      local: latestLocal ? { score: latestLocal.summary?.score ?? latestLocal.analysis?.score } : null,
      quality: latestQuality ? { score: latestQuality.score } : null,
      keyword: { opportunityCount },
      competitor: latestComp
        ? { keywordGaps: latestComp.summary?.keywordGaps, contentGaps: latestComp.summary?.contentGaps }
        : null,
      analytics,
      monitoring,
      experiments: null,
      contentStrategy: strategies[0],
    });
    const aiSummary = await explainStrategyWithAI(plan);
    const saved = await createStrategyRun({
      workspaceId: c.tenant.workspaceId,
      targetUrl,
      plan,
      createdBy: c.access.user.id,
      aiSummary,
    });
    return NextResponse.json({ plan, aiSummary, run: saved }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Strategy run failed.") }, { status: 400 });
  }
}
