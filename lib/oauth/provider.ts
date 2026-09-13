import { oauthConfig, type OAuthProvider } from "@/lib/oauth/config";
import { encryptSecret } from "@/lib/security/secrets";
import { supabaseAdmin } from "@/lib/db/supabase-rest";

async function tokenRequest(url: string, params: URLSearchParams) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OAuth token exchange failed (${res.status}).`);
  return data;
}

export function authorizationUrl(provider: OAuthProvider, state: string) {
  const c = oauthConfig(provider);
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    scope: c.scopes.join(" "),
    state,
  });
  if (provider === "google-youtube") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  return `${c.authorize}?${params}`;
}

export async function completeOAuth(provider: OAuthProvider, code: string, workspaceId: string) {
  const c = oauthConfig(provider);
  const token = await tokenRequest(
    c.token,
    new URLSearchParams({
      code,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: c.redirectUri,
      grant_type: "authorization_code",
    })
  );
  if (!token.access_token) throw new Error("OAuth provider ne access token nahi diya.");

  if (provider === "google-youtube") {
    const expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
    const payload = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt,
      permission: "suggest",
      ...(typeof token.scope === "string" && token.scope.trim() ? { scope: token.scope } : {}),
    };
    await upsertConnection(workspaceId, "youtube", payload, expiresAt);
    return { provider, displayName: "YouTube", expiresAt };
  }

  if (provider === "google-search-console") {
    const expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
    const payload = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt,
      permission: "suggest",
    };
    await upsertConnection(workspaceId, "google-search-console", payload, expiresAt);
    return { provider, displayName: "Google Search Console", expiresAt };
  }

  const version = process.env.FACEBOOK_GRAPH_VERSION || "v20.0";
  const userToken = await exchangeFacebookLongLivedToken(token.access_token);
  const pagesRes = await fetch(
    `https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  const pages = await pagesRes.json().catch(() => ({}));
  if (!pagesRes.ok || !Array.isArray(pages.data) || !pages.data.length)
    throw new Error("Facebook account se koi Page access nahi mila.");
  const page = pages.data[0];
  if (!page.id || !page.access_token) throw new Error("Facebook Page token could not be obtained.");
  await upsertConnection(workspaceId, "facebook", {
    pageId: page.id,
    pageAccessToken: page.access_token,
    pageName: page.name || "Facebook Page",
    permission: "suggest",
    pageSelection: "FIRST_PAGE_ONLY",
  });
  return {
    provider,
    displayName: page.name || "Facebook Page",
    pageId: page.id,
    pageSelection: "FIRST_PAGE_ONLY",
    note: "Nexora Free Beta connects the first Facebook Page returned by Meta. Multi-page selection is not available.",
  };
}

async function exchangeFacebookLongLivedToken(shortToken: string) {
  const c = oauthConfig("facebook");
  const url = new URL(c.token);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", c.clientId);
  url.searchParams.set("client_secret", c.clientSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error("Facebook long-lived token obtain nahi ho saka.");
  return data.access_token as string;
}

async function upsertConnection(
  workspaceId: string,
  provider: string,
  credentials: Record<string, unknown>,
  tokenExpiresAt?: number
) {
  const encrypted_credentials = encryptSecret(JSON.stringify(credentials));
  await supabaseAdmin(
    "connections",
    {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        provider,
        display_name: String(credentials.pageName || provider),
        encrypted_credentials,
        status: "active",
        token_expires_at: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    },
    "?on_conflict=workspace_id,provider"
  );
}
