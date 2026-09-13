// Analytics pillar (Section 1a). Uses YouTube Data API v3 "statistics"
// (views/likes/comments) with the stored YouTube connection. Watch time,
// retention, and CTR-style reports use the separate YouTube Analytics API
// in lib/analytics/youtube-deep.ts and require yt-analytics.readonly.
// See docs/INTEGRATIONS.md.

import type { YouTubeSettings } from "@/lib/store";
import { type UnknownRecord } from "@/lib/unknown";

const YT_API = "https://www.googleapis.com/youtube/v3";

export interface YouTubeChannelStats {
  channelTitle: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

export interface YouTubeVideoStats {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
}

export async function getYouTubeChannelStats(settings: YouTubeSettings): Promise<YouTubeChannelStats | null> {
  const res = await fetch(`${YT_API}/channels?part=snippet,statistics&mine=true`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    channelTitle: item.snippet.title,
    subscriberCount: Number(item.statistics.subscriberCount ?? 0),
    viewCount: Number(item.statistics.viewCount ?? 0),
    videoCount: Number(item.statistics.videoCount ?? 0),
  };
}

export async function getYouTubeVideoStats(
  settings: YouTubeSettings,
  videoIds: string[]
): Promise<YouTubeVideoStats[]> {
  if (videoIds.length === 0) return [];
  const res = await fetch(`${YT_API}/videos?part=snippet,statistics&id=${videoIds.join(",")}`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item: UnknownRecord) => ({
    videoId: item.id,
    title: item.snippet.title,
    viewCount: Number(item.statistics.viewCount ?? 0),
    likeCount: Number(item.statistics.likeCount ?? 0),
    commentCount: Number(item.statistics.commentCount ?? 0),
    publishedAt: item.snippet.publishedAt,
  }));
}
