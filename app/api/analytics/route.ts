import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { getSeoScoreHistoryRemote, listDraftsRemote, getPublishSettingsRemote } from "@/lib/store-repository";
import { getTenantContext } from "@/lib/tenant";
import { getYouTubeChannelStats, getYouTubeVideoStats } from "@/lib/analytics/youtube";
import { getFacebookPageStats, getFacebookRecentPosts } from "@/lib/analytics/facebook";
import { flagUnderperforming } from "@/lib/analytics/audit";
import { getSearchConsoleConnection, getSearchConsoleSummary } from "@/lib/analytics/search-console";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const settings = await getPublishSettingsRemote({ req, workspaceId: tenant?.workspaceId });
  const drafts = await listDraftsRemote({ req, workspaceId: tenant?.workspaceId });

  const result: UnknownRecord = {
    website: { scoreHistory: [] },
    youtube: null,
    facebook: null,
    searchConsole: null,
    snapshots: [],
  };

  // Website pillar: SEO score history, grouped by URL
  const allHistory = await getSeoScoreHistoryRemote({ req, workspaceId: tenant?.workspaceId });
  const byUrl: Record<string, { url: string; score: number; date: string }[]> = {};
  for (const entry of allHistory) {
    if (!byUrl[entry.url]) byUrl[entry.url] = [];
    byUrl[entry.url].push(entry);
  }
  result.website.scoreHistory = Object.entries(byUrl).map(([url, entries]) => {
    const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    return {
      url,
      latestScore: latest.score,
      previousScore: previous?.score ?? null,
      trend: previous ? latest.score - previous.score : null,
      history: sorted,
    };
  });

  // YouTube pillar: channel stats + stats for videos we've published to
  if (settings.youtube) {
    const channelStats = await getYouTubeChannelStats(settings.youtube.settings);
    const publishedVideoIds = Array.from(
      new Set(
        drafts
          .filter((d) => d.channel === "youtube" && d.status === "published" && d.videoId)
          .map((d) => d.videoId as string)
      )
    );
    const videoStats = await getYouTubeVideoStats(settings.youtube.settings, publishedVideoIds);
    const audited = flagUnderperforming(videoStats, (v) => v.viewCount);
    result.youtube = { channelStats, videos: audited };
  }

  // Google Search Console pillar: organic search performance.
  if (tenant?.workspaceId) {
    const connection = await getSearchConsoleConnection(tenant.workspaceId);
    if (connection) {
      try {
        const end = new Date(Date.now() - 86_400_000);
        const start = new Date(Date.now() - 29 * 86_400_000);
        result.searchConsole = await getSearchConsoleSummary(
          connection.credentials,
          start.toISOString().slice(0, 10),
          end.toISOString().slice(0, 10)
        );
      } catch (error: unknown) {
        result.searchConsole = { error: errorMessage(error, "Search Console unavailable.") };
      }
    }
    try {
      result.snapshots = await supabaseAdmin<UnknownRecord[]>(
        "analytics_snapshots",
        {},
        `?workspace_id=eq.${encodeURIComponent(tenant.workspaceId)}&order=created_at.desc&limit=30`
      );
    } catch {
      result.snapshots = [];
    }
  }

  // Facebook pillar: page stats + recent post engagement
  if (settings.facebook) {
    const pageStats = await getFacebookPageStats(settings.facebook.settings);
    const posts = await getFacebookRecentPosts(settings.facebook.settings);
    const audited = flagUnderperforming(posts, (p) => p.likeCount + p.commentCount + p.shareCount);
    result.facebook = { pageStats, posts: audited };
  }

  return NextResponse.json(result);
}
