import { getSearchConsoleConnection } from "@/lib/analytics/search-console";
import { listPublicationHistory } from "@/lib/rollback/history";
import { supabaseAdmin } from "@/lib/db/supabase-rest";

export interface PeriodMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number | null;
  startDate: string;
  endDate: string;
}

export interface AttributionReport {
  draftId: string;
  targetUrl: string;
  publicationDate: string;
  baseline: PeriodMetrics | null;
  postPeriod: PeriodMetrics | null;
  deltas: { clicks: number | null; impressions: number | null; ctr: number | null; averagePosition: number | null };
  seoScoreBefore: number | null;
  seoScoreAfter: number | null;
  interpretation: "correlation_only";
  caveats: string[];
}

function dateOnly(d: Date) { return d.toISOString().slice(0, 10); }
function shift(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }

async function queryPage(accessToken: string, siteUrl: string, pageUrl: string, startDate: string, endDate: string): Promise<PeriodMetrics> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions: ["page"], dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }], rowLimit: 1000 }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Search Console page analytics request failed (${res.status}).`);
  let clicks = 0, impressions = 0, weightedPosition = 0;
  for (const row of Array.isArray(data.rows) ? data.rows : []) {
    const c = Number(row.clicks || 0), i = Number(row.impressions || 0), p = Number(row.position || 0);
    clicks += c; impressions += i; weightedPosition += p * i;
  }
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, averagePosition: impressions ? weightedPosition / impressions : null, startDate, endDate };
}

export async function buildAttributionReport(workspaceId: string, draftId: string, targetUrl: string): Promise<AttributionReport> {
  const history = await listPublicationHistory(workspaceId, draftId);
  const published = history.filter((h: any) => h.event_type === "published" || h.event_type === "rollback_published").sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at))).pop();
  if (!published) throw new Error("Is draft ke liye koi successful publication history nahi mili.");
  const publicationDate = new Date(published.created_at);
  const connection = await getSearchConsoleConnection(workspaceId);
  if (!connection) throw new Error("Google Search Console connection not configured.");
  const siteUrl = connection.credentials.siteUrl;
  if (!siteUrl) throw new Error("Search Console property configured nahi hai.");

  // Search Console data can lag by a few days. Exclude a 3-day attribution buffer around publication.
  const baselineEnd = shift(publicationDate, -4);
  const baselineStart = shift(baselineEnd, -27);
  const postStart = shift(publicationDate, 4);
  const postEnd = shift(postStart, 27);
  const [baseline, postPeriod] = await Promise.all([
    queryPage(connection.credentials.accessToken, siteUrl, targetUrl, dateOnly(baselineStart), dateOnly(baselineEnd)),
    queryPage(connection.credentials.accessToken, siteUrl, targetUrl, dateOnly(postStart), dateOnly(postEnd)),
  ]);

  let seoScoreBefore: number | null = null, seoScoreAfter: number | null = null;
  try {
    const scores = await supabaseAdmin<any[]>("seo_score_history", {}, `?workspace_id=eq.${encodeURIComponent(workspaceId)}&url=eq.${encodeURIComponent(targetUrl)}&created_at=lt.${encodeURIComponent(publicationDate.toISOString())}&order=created_at.desc&limit=1`);
    seoScoreBefore = scores[0]?.score == null ? null : Number(scores[0].score);
    const after = await supabaseAdmin<any[]>("seo_score_history", {}, `?workspace_id=eq.${encodeURIComponent(workspaceId)}&url=eq.${encodeURIComponent(targetUrl)}&created_at=gte.${encodeURIComponent(publicationDate.toISOString())}&order=created_at.asc&limit=1`);
    seoScoreAfter = after[0]?.score == null ? null : Number(after[0].score);
  } catch { /* score history is supplementary */ }

  return {
    draftId, targetUrl, publicationDate: publicationDate.toISOString(), baseline, postPeriod,
    deltas: {
      clicks: postPeriod.clicks - baseline.clicks,
      impressions: postPeriod.impressions - baseline.impressions,
      ctr: postPeriod.ctr - baseline.ctr,
      averagePosition: baseline.averagePosition != null && postPeriod.averagePosition != null ? postPeriod.averagePosition - baseline.averagePosition : null,
    },
    seoScoreBefore, seoScoreAfter, interpretation: "correlation_only",
    caveats: ["Search Console data may be delayed and is not proof that the optimization caused the change.", "Seasonality, algorithm updates, competing pages, links, SERP changes and other factors can affect performance.", "The comparison uses equal 28-day windows with a 3-day publication buffer."],
  };
}
