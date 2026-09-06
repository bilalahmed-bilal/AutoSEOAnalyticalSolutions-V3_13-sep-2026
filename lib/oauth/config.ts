export type OAuthProvider = "google-youtube" | "google-search-console" | "facebook";

export function oauthConfig(provider: OAuthProvider) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL is required for OAuth.");
  if (provider === "google-youtube" || provider === "google-search-console") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("Google OAuth credentials are not configured.");
    return { authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: `${base}/api/oauth/callback/${provider}`, scopes: provider === "google-youtube"
      ? ["https://www.googleapis.com/auth/youtube.force-ssl"]
      : ["https://www.googleapis.com/auth/webmasters.readonly"] };
  }
  if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) throw new Error("Facebook OAuth credentials are not configured.");
  const version = process.env.FACEBOOK_GRAPH_VERSION || "v20.0";
  return { authorize: `https://www.facebook.com/${version}/dialog/oauth`, token: `https://graph.facebook.com/${version}/oauth/access_token`, clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET, redirectUri: `${base}/api/oauth/callback/facebook`, scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] };
}
