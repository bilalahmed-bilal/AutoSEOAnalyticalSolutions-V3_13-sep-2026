import { getSearchConsoleConnection } from "@/lib/analytics/search-console";
export interface PageMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number | null;
}
export async function queryExperimentPage(
  workspaceId: string,
  pageUrl: string,
  startDate: string,
  endDate: string
): Promise<PageMetrics> {
  const connection = await getSearchConsoleConnection(workspaceId);
  if (!connection) throw new Error("Google Search Console connection not configured.");
  const siteUrl = connection.credentials.siteUrl;
  if (!siteUrl) throw new Error("Search Console property configured nahi hai.");
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${connection.credentials.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["page"],
        dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }],
        rowLimit: 1000,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Search Console page analytics request failed (${res.status}).`);
  let clicks = 0,
    impressions = 0,
    weighted = 0;
  for (const row of Array.isArray(data.rows) ? data.rows : []) {
    const c = Number(row.clicks || 0),
      i = Number(row.impressions || 0),
      p = Number(row.position || 0);
    clicks += c;
    impressions += i;
    weighted += p * i;
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    averagePosition: impressions ? weighted / impressions : null,
  };
}
