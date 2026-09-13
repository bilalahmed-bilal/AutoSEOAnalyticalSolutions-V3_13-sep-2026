// Analytics pillar (Section 1a). Uses the same Page Access Token already
// set up in Phase 4. Post-level reach/impressions require the deeper Page
// Insights API (extra review from Meta for some metrics); this starts with
// what's reliably available — fan count and per-post engagement counts
// (likes/comments/shares) — which is enough to power the channel-audit
// "underperforming content" comparison. Deeper Insights metrics are a
// documented future upgrade (see docs/INTEGRATIONS.md).

import type { FacebookSettings } from "@/lib/store";
import { type UnknownRecord } from "@/lib/unknown";

const GRAPH_API = "https://graph.facebook.com/v20.0";

export interface FacebookPageStats {
  pageName: string;
  fanCount: number;
}

export interface FacebookPostStats {
  postId: string;
  message: string;
  createdTime: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

export async function getFacebookPageStats(settings: FacebookSettings): Promise<FacebookPageStats | null> {
  const res = await fetch(
    `${GRAPH_API}/${settings.pageId}?fields=name,fan_count&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return { pageName: data.name, fanCount: Number(data.fan_count ?? 0) };
}

export async function getFacebookRecentPosts(settings: FacebookSettings, limit = 10): Promise<FacebookPostStats[]> {
  const fields = "message,created_time,likes.summary(true),comments.summary(true),shares";
  const res = await fetch(
    `${GRAPH_API}/${settings.pageId}/posts?fields=${fields}&limit=${limit}&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map((post: UnknownRecord) => ({
    postId: post.id,
    message: post.message || "(no text)",
    createdTime: post.created_time,
    likeCount: post.likes?.summary?.total_count ?? 0,
    commentCount: post.comments?.summary?.total_count ?? 0,
    shareCount: post.shares?.count ?? 0,
  }));
}
