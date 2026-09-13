import type { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export interface CompetitorProject {
  id: string;
  workspaceId: string;
  name: string;
  targetUrl: string;
  competitorUrls: string[];
  keywordProjectId?: string;
  status: string;
  summary: UnknownRecord;
  analysis: UnknownRecord;
  createdAt: string;
  updatedAt: string;
}
const q = (p: Record<string, string>) =>
  "?" +
  Object.entries(p)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
const map = (r: UnknownRecord): CompetitorProject => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  targetUrl: r.target_url,
  competitorUrls: r.competitor_urls || [],
  keywordProjectId: r.keyword_project_id ?? undefined,
  status: r.status,
  summary: r.summary || {},
  analysis: r.analysis || {},
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
export async function createCompetitorProject(
  ctx: { req: NextRequest; workspaceId: string },
  input: {
    name: string;
    targetUrl: string;
    competitorUrls: string[];
    keywordProjectId?: string;
    status?: string;
    summary?: UnknownRecord;
    analysis?: UnknownRecord;
  }
) {
  const [r] = await supabaseRest<UnknownRecord[]>(ctx.req, "competitor_projects", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: ctx.workspaceId,
      name: input.name,
      target_url: input.targetUrl,
      competitor_urls: input.competitorUrls,
      keyword_project_id: input.keywordProjectId || null,
      status: input.status || "ready",
      summary: input.summary || {},
      analysis: input.analysis || {},
    }),
    headers: { Prefer: "return=representation" },
  });
  return map(r);
}
export async function listCompetitorProjects(ctx: { req: NextRequest; workspaceId: string }) {
  const rows = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "competitor_projects",
    {},
    q({ workspace_id: `eq.${ctx.workspaceId}`, order: "created_at.desc" })
  );
  return rows.map(map);
}
export async function getCompetitorProject(ctx: { req: NextRequest; workspaceId: string }, id: string) {
  const rows = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "competitor_projects",
    {},
    q({ workspace_id: `eq.${ctx.workspaceId}`, id: `eq.${id}`, limit: "1" })
  );
  return rows[0] ? map(rows[0]) : null;
}
