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

export async function testFacebookConnection(
  settings: FacebookSettings
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(
      `${GRAPH_API}/${settings.pageId}?fields=name&access_token=${settings.pageAccessToken}`,
      { signal: AbortSignal.timeout(10_000) }
    );
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
