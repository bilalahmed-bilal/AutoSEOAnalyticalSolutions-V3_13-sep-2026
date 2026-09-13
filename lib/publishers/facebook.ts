import { type UnknownRecord } from "@/lib/unknown";
// Fourth publish adapter. Posts text (optionally with a link) to a connected
// Facebook Page's feed via the Meta Graph API.
//
// AUTH NOTE: expects a Page Access Token (not a personal user token) with the
// pages_manage_posts permission, already obtained via Meta's OAuth flow and
// a registered Meta for Developers app. That app-registration/OAuth setup
// happens outside this codebase (see docs/youtube-facebook-setup.md).

export interface FacebookSettings {
  pageId: string;
  pageAccessToken: string;
}

const GRAPH_API = "https://graph.facebook.com/v20.0";

export async function testFacebookConnection(settings: FacebookSettings): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${GRAPH_API}/${settings.pageId}?fields=name&access_token=${settings.pageAccessToken}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Facebook ne connection reject kar di (status ${res.status}). Page ID/token check karein.`,
      };
    }
    const data = await res.json();
    return { ok: true, message: data.name ? `Connected: "${data.name}".` : "Connected." };
  } catch {
    return { ok: false, message: "Facebook tak nahi pahunch paye. Dobara koshish karein." };
  }
}

export async function publishToFacebook(
  settings: FacebookSettings,
  post: { message: string }
): Promise<{ link: string }> {
  const res = await fetch(`${GRAPH_API}/${settings.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: post.message,
      access_token: settings.pageAccessToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Facebook publish failed (status ${res.status}): ${errText}`);
  }

  const data = await res.json();
  const postId = (data.id as string) || "";
  return { link: `https://www.facebook.com/${postId}` };
}

export interface PageInfo {
  id: string;
  name: string;
  about: string;
  category: string;
  fanCount: number;
}

export async function fetchPageInfo(settings: FacebookSettings): Promise<PageInfo> {
  const res = await fetch(
    `${GRAPH_API}/${settings.pageId}?fields=name,about,category,fan_count&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`Page info fetch failed (status ${res.status}).`);
  const data = await res.json();
  return {
    id: data.id,
    name: data.name || "",
    about: data.about || "",
    category: data.category || "",
    fanCount: Number(data.fan_count ?? 0),
  };
}

// Updating a Page's About/category requires the pages_manage_metadata
// permission on the Page Access Token (in addition to pages_manage_posts
// used for publishing) — if the token lacks it, Facebook returns a clear
// permission error which is surfaced as-is rather than papered over.
export async function updatePageInfo(settings: FacebookSettings, fields: { about?: string }): Promise<{ ok: true }> {
  const res = await fetch(`${GRAPH_API}/${settings.pageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, access_token: settings.pageAccessToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Page update failed (status ${res.status}): ${errText}`);
  }
  return { ok: true };
}

export interface PageComment {
  id: string;
  message: string;
  from: string;
  createdTime: string;
}

export async function fetchPostComments(settings: FacebookSettings, postId: string): Promise<PageComment[]> {
  const res = await fetch(
    `${GRAPH_API}/${postId}/comments?fields=message,from,created_time&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`Comments fetch failed (status ${res.status}). Post ID check karein.`);
  const data = await res.json();
  return (data.data || []).map((c: UnknownRecord) => ({
    id: c.id,
    message: c.message || "",
    from: c.from?.name || "Unknown",
    createdTime: c.created_time,
  }));
}

export async function replyToComment(
  settings: FacebookSettings,
  commentId: string,
  message: string
): Promise<{ ok: true }> {
  const res = await fetch(`${GRAPH_API}/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: settings.pageAccessToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Reply failed (status ${res.status}): ${errText}`);
  }
  return { ok: true };
}

export interface PublicPageStats {
  pageId: string;
  name: string;
  fanCount: number;
}

// Looks up ANY public Facebook Page's basic stats (for competitor tracking),
// using the same access token as the connected Page — works for public
// Pages regardless of who manages them.
export async function fetchPublicPageStats(
  settings: FacebookSettings,
  pageIdOrUsername: string
): Promise<PublicPageStats> {
  const res = await fetch(
    `${GRAPH_API}/${encodeURIComponent(pageIdOrUsername.trim())}?fields=name,fan_count&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`"${pageIdOrUsername}" page nahi mila (status ${res.status}).`);
  const data = await res.json();
  return { pageId: data.id, name: data.name, fanCount: Number(data.fan_count ?? 0) };
}

// Meta significantly restricted/deprecated its classic Audience Insights
// tool — demographic breakdowns are now limited and mostly require Business
// Manager-level access beyond a single Page token. This attempts the
// still-available page_fans_gender_age insight and surfaces a clear error
// if it's not accessible, rather than fabricating demographic data.
export interface AudienceDemographics {
  breakdown: Record<string, number>;
}

export async function fetchAudienceInsights(settings: FacebookSettings): Promise<AudienceDemographics> {
  const res = await fetch(
    `${GRAPH_API}/${settings.pageId}/insights?metric=page_fans_gender_age&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (res.status === 400 || res.status === 403) {
    throw new Error(
      "Meta ne is Page ke liye demographic data available nahi rakha — classic Audience Insights tool bohot restrict/deprecated ho chuka hai. Basic fan count 'Page & Post Discovery' tab mein dekh sakte hain."
    );
  }
  if (!res.ok) throw new Error(`Insights fetch failed (status ${res.status}).`);
  const data = await res.json();
  const values = data.data?.[0]?.values?.[0]?.value;
  if (!values) throw new Error("Koi demographic data nahi mila.");
  return { breakdown: values };
}
