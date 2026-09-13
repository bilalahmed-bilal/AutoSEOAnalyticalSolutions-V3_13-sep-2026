import { getSearchConsoleConnection, getSearchConsoleSummary } from "@/lib/analytics/search-console";
import { listDraftsRemote, getSeoScoreHistoryRemote } from "@/lib/store-repository";
import { NextRequest } from "next/server";
import { type UnknownRecord } from "@/lib/unknown";

export interface AdvancedAnalytics {
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  traffic: { current: Metric; previous: Metric | null; delta: MetricDelta | null };
  content: {
    published: number;
    publishedDrafts: Array<{ id: string; title: string; channel: string; createdAt: string }>;
  };
  seo: { currentAverage: number | null; previousAverage: number | null; delta: number | null; urls: number };
  attribution: { attributedDrafts: number; positive: number; neutral: number; negative: number; correlationOnly: true };
  roi: { estimatedOrganicClicks: number; clicksPerPublishedContent: number | null; methodology: string };
  recommendations: string[];
}
interface Metric {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number | null;
}
interface MetricDelta {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number | null;
}
function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}
function shift(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

export async function buildAdvancedAnalytics(
  req: NextRequest,
  workspaceId: string,
  startDate?: string,
  endDate?: string
): Promise<AdvancedAnalytics> {
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : shift(new Date(), -1);
  const start = startDate ? new Date(`${startDate}T00:00:00Z`) : shift(end, -27);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end)
    throw new Error("Valid analytics date range required.");
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevEnd = shift(start, -1),
    prevStart = shift(prevEnd, -(days - 1));
  const connection = await getSearchConsoleConnection(workspaceId);
  let current: Metric = { clicks: 0, impressions: 0, ctr: 0, averagePosition: null };
  let previous: Metric | null = null;
  if (connection) {
    const [c, p] = await Promise.all([
      getSearchConsoleSummary(connection.credentials, dateOnly(start), dateOnly(end)),
      getSearchConsoleSummary(connection.credentials, dateOnly(prevStart), dateOnly(prevEnd)),
    ]);
    current = { clicks: c.clicks, impressions: c.impressions, ctr: c.ctr, averagePosition: c.averagePosition };
    previous = { clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, averagePosition: p.averagePosition };
  }
  const delta = previous
    ? {
        clicks: current.clicks - previous.clicks,
        impressions: current.impressions - previous.impressions,
        ctr: current.ctr - previous.ctr,
        averagePosition:
          current.averagePosition != null && previous.averagePosition != null
            ? current.averagePosition - previous.averagePosition
            : null,
      }
    : null;
  const drafts = await listDraftsRemote({ req, workspaceId });
  const published = drafts.filter((d: UnknownRecord) => d.status === "published");
  const history = await getSeoScoreHistoryRemote({ req, workspaceId });
  const byUrl = new Map<string, UnknownRecord[]>();
  for (const h of history) {
    const arr = byUrl.get(h.url) || [];
    arr.push(h);
    byUrl.set(h.url, arr);
  }
  const currentScores: number[] = [];
  const previousScores: number[] = [];
  for (const arr of byUrl.values()) {
    for (const h of arr) {
      const t = new Date(h.date).getTime();
      if (t >= start.getTime() && t <= end.getTime()) currentScores.push(Number(h.score));
      else if (t >= prevStart.getTime() && t <= prevEnd.getTime()) previousScores.push(Number(h.score));
    }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const currentAvg = avg(currentScores),
    previousAvg = avg(previousScores);
  const positive = delta && delta.clicks > 0 ? 1 : 0;
  const negative = delta && delta.clicks < 0 ? 1 : 0;
  const recommendations: string[] = [];
  if (delta && delta.clicks < 0)
    recommendations.push(
      "Organic clicks period-over-period down hain; top pages aur affected queries ko review karein."
    );
  if (delta && delta.impressions < 0)
    recommendations.push(
      "Search impressions down hain; keyword coverage aur indexation/technical signals review karein."
    );
  if (delta && delta.averagePosition != null && delta.averagePosition > 0)
    recommendations.push(
      "Average position numerically worse hui hai; priority queries ke on-page aur internal-link signals check karein."
    );
  if (currentAvg != null && previousAvg != null && currentAvg < previousAvg)
    recommendations.push(
      "SEO score improve hua hai; jis content ne change drive kiya usay Search Console performance ke sath correlate karein."
    );
  if (!recommendations.length)
    recommendations.push(
      "Current period mein koi major regression signal nahi mila; winning pages aur queries ko continue monitor karein."
    );
  return {
    periodStart: dateOnly(start),
    periodEnd: dateOnly(end),
    previousPeriodStart: dateOnly(prevStart),
    previousPeriodEnd: dateOnly(prevEnd),
    traffic: { current, previous, delta },
    content: {
      published: published.length,
      publishedDrafts: published.map((d: UnknownRecord) => ({
        id: d.id,
        title: d.title,
        channel: d.channel,
        createdAt: d.createdAt,
      })),
    },
    seo: {
      currentAverage: currentAvg,
      previousAverage: previousAvg,
      delta: currentAvg != null && previousAvg != null ? currentAvg - previousAvg : null,
      urls: byUrl.size,
    },
    attribution: { attributedDrafts: 0, positive, neutral: 1 - positive - negative, negative, correlationOnly: true },
    roi: {
      estimatedOrganicClicks: current.clicks,
      clicksPerPublishedContent: published.length ? current.clicks / published.length : null,
      methodology:
        "Directional analytics only: organic clicks are not financial revenue and attribution is correlation-only.",
    },
    recommendations,
  };
}
