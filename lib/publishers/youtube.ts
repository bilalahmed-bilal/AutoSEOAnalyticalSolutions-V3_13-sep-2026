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

export async function testYouTubeConnection(
  settings: YouTubeSettings
): Promise<{ ok: boolean; message: string }> {
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

export async function updateYouTubeVideo(
  settings: YouTubeSettings,
  videoId: string,
  content: { title: string; description: string; tags?: string[] }
): Promise<{ link: string }> {
  // Need the existing categoryId — YouTube's update call requires the full
  // snippet, so fetch the current one first and only overwrite title/desc/tags.
  const getRes = await fetch(`${YT_API}/videos?part=snippet&id=${videoId}`, {
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

  const res = await fetch(`${YT_API}/videos?part=snippet`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        ...existingSnippet,
        title: content.title,
        description: content.description,
        tags: content.tags || existingSnippet.tags,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube update failed (status ${res.status}): ${errText}`);
  }

  return { link: `https://www.youtube.com/watch?v=${videoId}` };
}
