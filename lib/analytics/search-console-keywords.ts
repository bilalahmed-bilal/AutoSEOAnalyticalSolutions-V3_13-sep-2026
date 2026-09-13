import { getSearchConsoleConnection, type SearchConsoleSettings } from "@/lib/analytics/search-console";
import { type UnknownRecord } from "@/lib/unknown";

async function query(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: 25000 }),
      signal: AbortSignal.timeout(15000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Search Console keyword query failed (${res.status}).`);
  return Array.isArray(data.rows) ? data.rows : [];
}
export async function getSearchConsoleKeywordQueries(
  workspaceId: string,
  startDate: string,
  endDate: string,
  seed: string
) {
  const connection = await getSearchConsoleConnection(workspaceId);
  if (!connection) return { connected: false, queries: [] };
  const settings = connection.credentials as SearchConsoleSettings;
  const sites = await (async () => {
    const r = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${settings.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Search Console sites request failed (${r.status}).`);
    const d = await r.json();
    return (d.siteEntry || [])
      .map((s: UnknownRecord) => ({
        siteUrl: String(s.siteUrl || ""),
        permissionLevel: String(s.permissionLevel || ""),
      }))
      .filter((s: UnknownRecord) => s.siteUrl);
  })();
  const siteUrl =
    settings.siteUrl ||
    sites.find((s: UnknownRecord) => /siteFullUser|siteOwner/i.test(s.permissionLevel))?.siteUrl ||
    sites[0]?.siteUrl;
  if (!siteUrl) return { connected: true, queries: [] };
  const rows = await query(settings.accessToken, siteUrl, startDate, endDate);
  const s = seed.toLowerCase().trim();
  const queries = rows
    .map((r: UnknownRecord) => String(r.keys?.[0] || "").trim())
    .filter(
      (q: string) =>
        q && (q.toLowerCase().includes(s) || s.split(/\s+/).some((w) => w.length > 2 && q.toLowerCase().includes(w)))
    );
  return { connected: true, siteUrl, queries: [...new Set(queries)] };
}
