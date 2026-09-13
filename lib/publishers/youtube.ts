import crypto from "node:crypto";
import { type UnknownRecord } from "@/lib/unknown";

// Third publish adapter (same pattern as wordpress.ts / custom-site.ts).
//
// IMPORTANT SCOPE NOTE: YouTube's API can only update metadata (title,
// description, tags) on a video that ALREADY EXISTS on the channel — actually
// uploading a new video requires the raw video file, which this text/content
// pipeline does not produce. So "publish to YouTube" here means: take
// Claude-generated title/description/tags and apply them to a video ID the
// user provides (e.g. one they just uploaded manually, or an older video
// they're re-optimizing — this covers the TubeBuddy/vidIQ "SEO Studio"
// use case from Section 4.8 well). True auto-upload is a future extension.
//
// AUTH NOTE: this adapter expects an OAuth 2.0 access token with the
// youtube.force-ssl scope, already obtained. Getting that token requires
// registering an app in Google Cloud Console and completing the OAuth
// consent flow — that setup happens outside this codebase (see
// docs/youtube-facebook-setup.md). This file assumes you already have a
// valid token to pass in.

export interface YouTubeSettings {
  accessToken: string;
}

const YT_API = "https://www.googleapis.com/youtube/v3";

export async function testYouTubeConnection(settings: YouTubeSettings): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${YT_API}/channels?part=snippet&mine=true`, {
      headers: { Authorization: `Bearer ${settings.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `YouTube ne connection reject kar di (status ${res.status}). Access token check karein — expire to nahi ho gaya?`,
      };
    }
    const data = await res.json();
    const channelName = data.items?.[0]?.snippet?.title;
    return {
      ok: true,
      message: channelName ? `Connected: "${channelName}".` : "Connected.",
    };
  } catch {
    return { ok: false, message: "YouTube tak nahi pahunch paye. Dobara koshish karein." };
  }
}

function canonicalizeYouTubeContent(content: { title: string; description: string; tags?: string[] }) {
  return JSON.stringify({
    title: content.title.trim(),
    description: content.description,
    tags: (content.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  });
}

export function youtubePublicationFingerprint(
  videoId: string,
  content: { title: string; description: string; tags?: string[] }
) {
  return crypto
    .createHash("sha256")
    .update(`youtube:update\n${videoId.trim()}\n${canonicalizeYouTubeContent(content)}`, "utf8")
    .digest("hex");
}

function matchesDesiredYouTubeContent(
  snippet: UnknownRecord,
  content: { title: string; description: string; tags?: string[] }
) {
  const desiredTags = (content.tags ?? snippet.tags ?? []).map((tag: string) => String(tag).trim()).filter(Boolean);
  const actualTags = (snippet.tags ?? []).map((tag: string) => tag.trim()).filter(Boolean);
  return (
    snippet.title === content.title &&
    (snippet.description ?? "") === content.description &&
    JSON.stringify(actualTags) === JSON.stringify(desiredTags)
  );
}

async function fetchYouTubeSnippetForUpdate(settings: YouTubeSettings, videoId: string) {
  const getRes = await fetch(`${YT_API}/videos?part=snippet&id=${encodeURIComponent(videoId)}`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!getRes.ok) {
    throw new Error(`Video fetch failed (status ${getRes.status}). Video ID check karein.`);
  }
  const getData = await getRes.json();
  const existingSnippet = getData.items?.[0]?.snippet;
  if (!existingSnippet) {
    throw new Error("Ye video ID nahi mila aapke connected channel par.");
  }
  return existingSnippet;
}

export async function updateYouTubeVideo(
  settings: YouTubeSettings,
  videoId: string,
  content: { title: string; description: string; tags?: string[] }
): Promise<{ link: string; idempotent: boolean; fingerprint: string }> {
  const normalizedVideoId = videoId.trim();
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(normalizedVideoId)) {
    throw new Error("Invalid YouTube video ID.");
  }

  const fingerprint = youtubePublicationFingerprint(normalizedVideoId, content);
  const existingSnippet = await fetchYouTubeSnippetForUpdate(settings, normalizedVideoId);

  // Idempotency fast path: the provider already has the intended state.
  if (matchesDesiredYouTubeContent(existingSnippet, content)) {
    return {
      link: `https://www.youtube.com/watch?v=${normalizedVideoId}`,
      idempotent: true,
      fingerprint,
    };
  }

  const desiredSnippet = {
    ...existingSnippet,
    title: content.title,
    description: content.description,
    tags: content.tags ?? existingSnippet.tags,
  };

  const res = await fetch(`${YT_API}/videos?part=snippet`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: normalizedVideoId, snippet: desiredSnippet }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text();

    // The PUT may have succeeded at Google but the response may have been
    // lost. Reconcile the provider state before reporting a retryable failure.
    try {
      const afterFailure = await fetchYouTubeSnippetForUpdate(settings, normalizedVideoId);
      if (matchesDesiredYouTubeContent(afterFailure, content)) {
        return {
          link: `https://www.youtube.com/watch?v=${normalizedVideoId}`,
          idempotent: true,
          fingerprint,
        };
      }
    } catch {
      // Preserve the original provider error; the durable job worker may retry.
    }

    throw new Error(`YouTube update failed (status ${res.status}): ${errText}`);
  }

  // Post-publish verification protects against accepting an incomplete/altered
  // provider response as success.
  const verifiedSnippet = await fetchYouTubeSnippetForUpdate(settings, normalizedVideoId);
  if (!matchesDesiredYouTubeContent(verifiedSnippet, content)) {
    throw new Error("YouTube update verification failed: provider state does not match the requested content.");
  }

  return {
    link: `https://www.youtube.com/watch?v=${normalizedVideoId}`,
    idempotent: false,
    fingerprint,
  };
}

export interface VideoSnippet {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export async function fetchVideoSnippet(settings: YouTubeSettings, videoId: string): Promise<VideoSnippet> {
  const res = await fetch(`${YT_API}/videos?part=snippet,statistics&id=${videoId}`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Video fetch failed (status ${res.status}). Video ID check karein.`);
  }
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error("Ye video ID nahi mila aapke connected channel par.");
  return {
    videoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description || "",
    tags: item.snippet.tags || [],
    publishedAt: item.snippet.publishedAt,
    viewCount: Number(item.statistics.viewCount ?? 0),
    likeCount: Number(item.statistics.likeCount ?? 0),
    commentCount: Number(item.statistics.commentCount ?? 0),
  };
}

// Lists all videos on the connected channel via its "uploads" playlist —
// the standard way to enumerate a channel's own videos via the Data API v3
// (there's no direct "list my videos" endpoint).
export async function listChannelVideos(settings: YouTubeSettings, maxResults = 25): Promise<VideoSnippet[]> {
  const channelRes = await fetch(`${YT_API}/channels?part=contentDetails&mine=true`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!channelRes.ok) throw new Error(`Channel fetch failed (status ${channelRes.status}).`);
  const channelData = await channelRes.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("Uploads playlist nahi mili.");

  const playlistRes = await fetch(
    `${YT_API}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${settings.accessToken}` }, signal: AbortSignal.timeout(10_000) }
  );
  if (!playlistRes.ok) throw new Error(`Video list fetch failed (status ${playlistRes.status}).`);
  const playlistData = await playlistRes.json();
  const videoIds: string[] = (playlistData.items || []).map((i: UnknownRecord) => i.contentDetails.videoId);
  if (videoIds.length === 0) return [];

  const detailsRes = await fetch(`${YT_API}/videos?part=snippet,statistics&id=${videoIds.join(",")}`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!detailsRes.ok) throw new Error(`Video details fetch failed (status ${detailsRes.status}).`);
  const detailsData = await detailsRes.json();
  return (detailsData.items || []).map((item: UnknownRecord) => ({
    videoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description || "",
    tags: item.snippet.tags || [],
    publishedAt: item.snippet.publishedAt,
    viewCount: Number(item.statistics.viewCount ?? 0),
    likeCount: Number(item.statistics.likeCount ?? 0),
    commentCount: Number(item.statistics.commentCount ?? 0),
  }));
}

export interface PublicChannelStats {
  channelId: string;
  title: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

// Looks up ANY public channel's stats (for competitor tracking) — works with
// a channel ID (UC...), or a @handle. Only public data, no special
// permission needed beyond a valid access token.
export async function fetchPublicChannelStats(
  settings: YouTubeSettings,
  channelIdOrHandle: string
): Promise<PublicChannelStats> {
  const input = channelIdOrHandle.trim();
  const isChannelId = /^UC[\w-]{22}$/.test(input);
  const param = isChannelId ? `id=${input}` : `forHandle=${encodeURIComponent(input.replace(/^@/, ""))}`;

  const res = await fetch(`${YT_API}/channels?part=snippet,statistics&${param}`, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Channel lookup failed (status ${res.status}).`);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error(`"${channelIdOrHandle}" naam ka channel nahi mila.`);
  return {
    channelId: item.id,
    title: item.snippet.title,
    subscriberCount: Number(item.statistics.subscriberCount ?? 0),
    viewCount: Number(item.statistics.viewCount ?? 0),
    videoCount: Number(item.statistics.videoCount ?? 0),
  };
}

// YouTube Analytics API (v2) — genuinely different from the Data API v3 used
// everywhere else in this adapter, and requires an ADDITIONAL OAuth scope
// (yt-analytics.readonly) beyond youtube.force-ssl. If the token doesn't have
// that scope, this throws a clear, actionable error rather than silently
// returning fake/zero data.
export interface RetentionInsights {
  averageViewDurationSeconds: number;
  averageViewPercentage: number;
  estimatedMinutesWatched: number;
}

export async function fetchRetentionInsights(settings: YouTubeSettings, videoId: string): Promise<RetentionInsights> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url =
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE` +
    `&startDate=${startDate}&endDate=${endDate}` +
    `&metrics=averageViewDuration,averageViewPercentage,estimatedMinutesWatched` +
    `&filters=video==${videoId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${settings.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 403 || res.status === 401) {
    throw new Error(
      "Ye data lene ke liye access token mein 'yt-analytics.readonly' scope chahiye — abhi wala token sirf 'youtube.force-ssl' scope ke sath hai. OAuth Playground mein dono scopes select kar ke naya token banayein (docs/youtube-facebook-setup.md dekhein)."
    );
  }
  if (!res.ok) {
    throw new Error(`Analytics fetch failed (status ${res.status}).`);
  }
  const data = await res.json();
  const row = data.rows?.[0];
  if (!row) throw new Error("Is video ke liye koi analytics data nahi mila (nayi video ho sakti hai).");
  return {
    averageViewDurationSeconds: row[0],
    averageViewPercentage: row[1],
    estimatedMinutesWatched: row[2],
  };
}
