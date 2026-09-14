import { type UnknownRecord } from "@/lib/unknown";
import { facebookGraphApiBase } from "@/lib/oauth/facebook-graph";
// Fourth publish adapter. Posts text (optionally with a link) to a connected
// Facebook Page's feed via the Meta Graph API.
//
// AUTH NOTE: expects a Page Access Token (not a personal user token) with the
// pages_manage_posts permission, already obtained via Meta's OAuth flow and
// a registered Meta for Developers app. That app-registration/OAuth setup
// happens through in-app Facebook OAuth. See docs/INTEGRATIONS.md.

export interface FacebookSettings {
  pageId: string;
  pageAccessToken: string;
}

function graphApi() {
  return facebookGraphApiBase();
}

export async function testFacebookConnection(settings: FacebookSettings): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${graphApi()}/${settings.pageId}?fields=name&access_token=${settings.pageAccessToken}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Facebook rejected the connection (status ${res.status}). Check the Page ID and token.`,
      };
    }
    const data = await res.json();
    return { ok: true, message: data.name ? `Connected: "${data.name}".` : "Connected." };
  } catch {
    return { ok: false, message: "Could not reach Facebook. Please try again." };
  }
}

export async function publishToFacebook(
  settings: FacebookSettings,
  post: { message: string }
): Promise<{ link: string }> {
  const res = await fetch(`${graphApi()}/${settings.pageId}/feed`, {
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
    console.error("facebook publish failed", res.status, errText.slice(0, 200));
    throw new Error("Facebook could not publish this post. Check the Page connection and try again.");
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
    `${graphApi()}/${settings.pageId}?fields=name,about,category,fan_count&access_token=${settings.pageAccessToken}`,
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
  const res = await fetch(`${graphApi()}/${settings.pageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, access_token: settings.pageAccessToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("facebook page update failed", res.status, errText.slice(0, 200));
    throw new Error("Facebook could not update this Page. The connected token may lack pages_manage_metadata.");
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
    `${graphApi()}/${postId}/comments?fields=message,from,created_time&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`Comments fetch failed (status ${res.status}). Check the Post ID.`);
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
  const res = await fetch(`${graphApi()}/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: settings.pageAccessToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("facebook comment reply failed", res.status, errText.slice(0, 200));
    throw new Error("Facebook could not send this reply. Check the comment ID and Page permissions.");
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
    `${graphApi()}/${encodeURIComponent(pageIdOrUsername.trim())}?fields=name,fan_count&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`"${pageIdOrUsername}" page was not found (status ${res.status}).`);
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
    `${graphApi()}/${settings.pageId}/insights?metric=page_fans_gender_age&access_token=${settings.pageAccessToken}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (res.status === 400 || res.status === 403) {
    throw new Error(
      "Meta does not make demographic data available for this Page — the classic Audience Insights tool has been heavily restricted or deprecated. You can view the basic fan count in the Page & Post Discovery tab."
    );
  }
  if (!res.ok) throw new Error(`Insights fetch failed (status ${res.status}).`);
  const data = await res.json();
  const values = data.data?.[0]?.values?.[0]?.value;
  if (!values) throw new Error("No demographic data was found.");
  return { breakdown: values };
}
