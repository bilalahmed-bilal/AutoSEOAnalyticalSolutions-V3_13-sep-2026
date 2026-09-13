import type { YouTubeSettings } from "@/lib/store";
import { YouTubeAnalyticsAuthorizationError, assertYouTubeAnalyticsAuthorized } from "@/lib/oauth/config";

const API = "https://youtubeanalytics.googleapis.com/v2/reports";

export interface YouTubeDeepMetrics {
  views: number;
  estimatedMinutesWatched: number;
  averageViewDurationSeconds: number;
  averageViewPercentage: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
}

export interface YouTubeVideoPerformance {
  videoId: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDurationSeconds: number;
  averageViewPercentage: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
}

export interface YouTubePerformanceRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  type: "retention" | "engagement" | "subscriber" | "reach" | "measurement";
  title: string;
  reason: string;
  evidence: string[];
  action: string;
}

export interface YouTubePerformanceReport {
  periodStart: string;
  periodEnd: string;
  metrics: YouTubeDeepMetrics;
  videos: YouTubeVideoPerformance[];
  recommendations: YouTubePerformanceRecommendation[];
  methodology: string;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function metricNumber(row: unknown[], index: number) {
  const value = Number(row[index] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function queryAnalytics(
  settings: YouTubeSettings,
  params: URLSearchParams
): Promise<{ columnHeaders: Array<{ name: string }>; rows: unknown[][] }> {
  assertYouTubeAnalyticsAuthorized(settings.scope);
  const res = await fetch(`${API}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new YouTubeAnalyticsAuthorizationError();
  }
  if (!res.ok) {
    throw new Error("YouTube Analytics request failed. Reconnect YouTube if this continues.");
  }

  const data = await res.json();
  return { columnHeaders: data.columnHeaders ?? [], rows: data.rows ?? [] };
}

function toMetrics(row: unknown[]): YouTubeDeepMetrics {
  return {
    views: metricNumber(row, 0),
    estimatedMinutesWatched: metricNumber(row, 1),
    averageViewDurationSeconds: metricNumber(row, 2),
    averageViewPercentage: metricNumber(row, 3),
    likes: metricNumber(row, 4),
    comments: metricNumber(row, 5),
    shares: metricNumber(row, 6),
    subscribersGained: metricNumber(row, 7),
    subscribersLost: metricNumber(row, 8),
  };
}

export async function getYouTubePerformanceReport(
  settings: YouTubeSettings,
  options?: { startDate?: string; endDate?: string; videoIds?: string[] }
): Promise<YouTubePerformanceReport> {
  const end = options?.endDate ? new Date(`${options.endDate}T00:00:00Z`) : new Date(Date.now() - 86_400_000);
  const start = options?.startDate
    ? new Date(`${options.startDate}T00:00:00Z`)
    : new Date(end.getTime() - 29 * 86_400_000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Valid YouTube analytics date range required.");
  }

  const common = new URLSearchParams({
    ids: "channel==MINE",
    startDate: dateOnly(start),
    endDate: dateOnly(end),
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost",
  });

  const summary = await queryAnalytics(settings, common);
  const metrics = summary.rows[0] ? toMetrics(summary.rows[0]) : toMetrics([]);

  const byVideoParams = new URLSearchParams(common);
  byVideoParams.set("dimensions", "video");
  byVideoParams.set("sort", "-views");
  byVideoParams.set("maxResults", "50");
  if (options?.videoIds?.length) {
    const safeIds = options.videoIds.filter((id) => /^[A-Za-z0-9_-]{6,20}$/.test(id));
    if (safeIds.length) byVideoParams.set("filters", `video==${safeIds.join(",")}`);
  }
  const byVideo = await queryAnalytics(settings, byVideoParams);
  const videos = byVideo.rows
    .map((row) => ({
      videoId: String(row[0] ?? ""),
      ...toMetrics(row.slice(1)),
    }))
    .filter((video) => video.videoId);

  const recommendations = buildRecommendations(metrics, videos);

  return {
    periodStart: dateOnly(start),
    periodEnd: dateOnly(end),
    metrics,
    videos,
    recommendations,
    methodology:
      "YouTube Analytics API data only. Recommendations are deterministic evidence-based rules; no financial attribution or unsupported causal claim is inferred.",
  };
}

function buildRecommendations(metrics: YouTubeDeepMetrics, videos: YouTubeVideoPerformance[]) {
  const result: YouTubePerformanceRecommendation[] = [];
  const subscriberNet = metrics.subscribersGained - metrics.subscribersLost;
  const engagement = metrics.views > 0 ? (metrics.likes + metrics.comments + metrics.shares) / metrics.views : 0;

  if (metrics.averageViewPercentage > 0 && metrics.averageViewPercentage < 35) {
    result.push({
      id: "retention-low",
      priority: "high",
      type: "retention",
      title: "Retention is a priority",
      reason: "Average viewed percentage is below the 35% review threshold.",
      evidence: [`Average viewed: ${metrics.averageViewPercentage.toFixed(1)}%`],
      action:
        "Review the first 30–60 seconds, pacing, intro length and title-to-content promise on the lowest-retention videos.",
    });
  }

  if (engagement > 0 && engagement < 0.01) {
    result.push({
      id: "engagement-low",
      priority: "medium",
      type: "engagement",
      title: "Engagement is relatively low",
      reason: "Likes, comments and shares are below 1% of views for the selected period.",
      evidence: [`Engagement/view: ${(engagement * 100).toFixed(2)}%`],
      action: "Test clearer calls-to-action, stronger discussion prompts and more specific audience hooks.",
    });
  }

  if (metrics.views > 0 && subscriberNet <= 0) {
    result.push({
      id: "subscriber-conversion",
      priority: "medium",
      type: "subscriber",
      title: "Subscriber conversion needs review",
      reason: "Net subscriber change is not positive in the selected period.",
      evidence: [`Gained: ${metrics.subscribersGained}`, `Lost: ${metrics.subscribersLost}`, `Net: ${subscriberNet}`],
      action:
        "Compare high-view videos with subscriber gain and strengthen the channel-value CTA on videos that attract the right audience.",
    });
  }

  if (videos.length >= 3) {
    const top = videos.slice(0, 3);
    const topAvgRetention = top.reduce((sum, v) => sum + v.averageViewPercentage, 0) / top.length;
    if (topAvgRetention >= 50) {
      result.push({
        id: "winning-format",
        priority: "low",
        type: "reach",
        title: "A repeatable winning pattern may exist",
        reason: "Top-view videos also show strong average viewed percentage.",
        evidence: [`Top 3 average viewed: ${topAvgRetention.toFixed(1)}%`],
        action:
          "Inspect the common topic, format, hook and duration of these videos and test a controlled follow-up series.",
      });
    }
  }

  if (!result.length) {
    result.push({
      id: "no-major-signal",
      priority: "low",
      type: "measurement",
      title: "No major rule-based regression signal",
      reason: "The selected metrics did not cross the configured review thresholds.",
      evidence: [
        `Views: ${metrics.views}`,
        `Average viewed: ${metrics.averageViewPercentage.toFixed(1)}%`,
        `Net subscribers: ${subscriberNet}`,
      ],
      action: "Continue monitoring and compare the next period against this baseline.",
    });
  }
  return result;
}
