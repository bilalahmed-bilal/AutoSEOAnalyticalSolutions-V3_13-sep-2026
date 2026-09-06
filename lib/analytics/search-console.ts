import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { decryptSecret } from "@/lib/security/secrets";

export interface SearchConsoleSettings {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number;
  siteUrl?: string;
}

export interface SearchConsoleSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface SearchConsoleSummary {
  siteUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number | null;
  rows: number;
  periodStart: string;
  periodEnd: string;
}

async function listSites(accessToken: string): Promise<SearchConsoleSite[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Search Console sites request failed (${res.status}).`);
  const data = await res.json();
  return (data.siteEntry || []).map((s: any) => ({ siteUrl: String(s.siteUrl || ""), permissionLevel: String(s.permissionLevel || "") })).filter((s: SearchConsoleSite) => s.siteUrl);
}

async function querySearchAnalytics(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 25000 }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Search Console analytics request failed (${res.status}).`);
  return Array.isArray(data.rows) ? data.rows : [];
}

export async function getSearchConsoleSummary(settings: SearchConsoleSettings, startDate: string, endDate: string) {
  const sites = await listSites(settings.accessToken);
  const siteUrl = settings.siteUrl || sites.find((s) => /siteFullUser|siteOwner/i.test(s.permissionLevel))?.siteUrl || sites[0]?.siteUrl;
  if (!siteUrl) throw new Error("Google Search Console mein koi accessible property nahi mili.");
  const rows = await querySearchAnalytics(settings.accessToken, siteUrl, startDate, endDate);
  let clicks = 0, impressions = 0, weightedPosition = 0;
  for (const row of rows) {
    const c = Number(row.clicks || 0), i = Number(row.impressions || 0), p = Number(row.position || 0);
    clicks += c; impressions += i; weightedPosition += p * i;
  }
  return { siteUrl, clicks, impressions, ctr: impressions ? clicks / impressions : 0, averagePosition: impressions ? weightedPosition / impressions : null, rows: rows.length, periodStart: startDate, periodEnd: endDate } satisfies SearchConsoleSummary;
}

export async function getSearchConsoleConnection(workspaceId: string) {
  const rows = await supabaseAdmin<any[]>("connections", {}, `?workspace_id=eq.${encodeURIComponent(workspaceId)}&provider=eq.google-search-console&status=neq.revoked&limit=1`);
  const row = rows[0];
  if (!row) return null;
  return { ...row, credentials: JSON.parse(decryptSecret(row.encrypted_credentials)) as SearchConsoleSettings };
}

export async function listSearchConsoleSites(accessToken: string) { return listSites(accessToken); }
