import { runTechnicalAudit } from "@/lib/technical-seo";
import { getSearchConsoleConnection, getSearchConsoleSummary } from "@/lib/analytics/search-console";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export type MonitorMetric = { key: string; label: string; value: number | null; unit?: string };
export type MonitoringResult = {
  targetUrl: string;
  checkedAt: string;
  technicalScore: number | null;
  metrics: MonitorMetric[];
  alerts: Array<{
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    detail: string;
    delta?: number;
  }>;
  technical: UnknownRecord;
  searchConsole: UnknownRecord;
};

function pctDelta(current: number, previous: number) {
  return previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100;
}

export async function runSeoMonitoring(
  targetUrl: string,
  previous: UnknownRecord | null,
  workspaceId?: string
): Promise<MonitoringResult> {
  const technical = await runTechnicalAudit(targetUrl, 25);
  const alerts: MonitoringResult["alerts"] = [];
  const currentScore = Number.isFinite(Number(technical.score)) ? Number(technical.score) : null;
  const previousScore = previous?.technicalScore == null ? null : Number(previous.technicalScore);
  if (currentScore !== null && previousScore !== null) {
    const delta = currentScore - previousScore;
    if (delta <= -10)
      alerts.push({
        type: "technical_score_drop",
        severity: "high",
        title: "Technical SEO score dropped sharply",
        detail: `Score ${previousScore} → ${currentScore}.`,
        delta,
      });
    else if (delta <= -5)
      alerts.push({
        type: "technical_score_drop",
        severity: "medium",
        title: "Technical SEO score declined",
        detail: `Score ${previousScore} → ${currentScore}.`,
        delta,
      });
  }
  const issueCount = Array.isArray(technical.fixes) ? technical.fixes.length : 0;
  const previousIssues = Number(previous?.issueCount);
  if (Number.isFinite(previousIssues) && issueCount > previousIssues) {
    const delta = issueCount - previousIssues;
    alerts.push({
      type: "technical_regression",
      severity: delta >= 5 ? "high" : "medium",
      title: "Technical issues increased",
      detail: `${previousIssues} → ${issueCount} detected issues.`,
      delta,
    });
  }
  let searchConsole: UnknownRecord = null;
  try {
    const connection = workspaceId ? await getSearchConsoleConnection(workspaceId) : null;
    if (connection) {
      const end = new Date(Date.now() - 86400000);
      const start = new Date(Date.now() - 29 * 86400000);
      searchConsole = await getSearchConsoleSummary(
        connection.credentials,
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10)
      );
      const prev = previous?.searchConsole;
      if (prev) {
        const clickDelta = pctDelta(Number(searchConsole.clicks), Number(prev.clicks));
        const impDelta = pctDelta(Number(searchConsole.impressions), Number(prev.impressions));
        if (clickDelta !== null && clickDelta <= -30)
          alerts.push({
            type: "organic_click_drop",
            severity: "high",
            title: "Organic clicks dropped",
            detail: `Clicks changed ${clickDelta.toFixed(1)}% versus the previous snapshot.`,
            delta: clickDelta,
          });
        else if (clickDelta !== null && clickDelta <= -15)
          alerts.push({
            type: "organic_click_drop",
            severity: "medium",
            title: "Organic clicks declined",
            detail: `Clicks changed ${clickDelta.toFixed(1)}% versus the previous snapshot.`,
            delta: clickDelta,
          });
        if (impDelta !== null && impDelta <= -30)
          alerts.push({
            type: "impression_drop",
            severity: "medium",
            title: "Search impressions dropped",
            detail: `Impressions changed ${impDelta.toFixed(1)}%.`,
            delta: impDelta,
          });
        const pos = Number(searchConsole.averagePosition),
          prevPos = Number(prev.averagePosition);
        if (Number.isFinite(pos) && Number.isFinite(prevPos) && pos - prevPos >= 3)
          alerts.push({
            type: "position_regression",
            severity: "medium",
            title: "Average search position worsened",
            detail: `Position changed ${prevPos.toFixed(1)} → ${pos.toFixed(1)}.`,
            delta: pos - prevPos,
          });
      }
    }
  } catch (error: unknown) {
    searchConsole = { error: errorMessage(error, "Search Console unavailable.") };
  }
  const metrics: MonitorMetric[] = [
    { key: "technicalScore", label: "Technical SEO score", value: currentScore, unit: "score" },
    { key: "issueCount", label: "Technical issues", value: issueCount, unit: "issues" },
  ];
  if (searchConsole && !searchConsole.error) {
    metrics.push(
      { key: "clicks", label: "Search Console clicks", value: Number(searchConsole.clicks), unit: "clicks" },
      {
        key: "impressions",
        label: "Search impressions",
        value: Number(searchConsole.impressions),
        unit: "impressions",
      },
      { key: "ctr", label: "Search CTR", value: Number(searchConsole.ctr) * 100, unit: "%" },
      {
        key: "averagePosition",
        label: "Average position",
        value: searchConsole.averagePosition == null ? null : Number(searchConsole.averagePosition),
        unit: "position",
      }
    );
  }
  return {
    targetUrl,
    checkedAt: new Date().toISOString(),
    technicalScore: currentScore,
    metrics,
    alerts,
    technical,
    searchConsole,
  };
}
