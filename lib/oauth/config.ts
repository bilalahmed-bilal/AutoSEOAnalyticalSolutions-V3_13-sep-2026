import { facebookOAuthDialogUrl, facebookOAuthTokenUrl } from "@/lib/oauth/facebook-graph";

export type OAuthProvider = "google-youtube" | "google-search-console" | "facebook";

/** Database connections.provider value for YouTube. Do not rename. */
export const YOUTUBE_CONNECTION_PROVIDER = "youtube";

/** YouTube Data API v3 read/write on existing videos, comments, and captions. */
export const YOUTUBE_DATA_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

/** YouTube Analytics API reports (watch time, retention, channel/video metrics). */
export const YOUTUBE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";

/** Scopes requested by the in-app Google YouTube OAuth flow. */
export const YOUTUBE_OAUTH_SCOPES = [YOUTUBE_DATA_SCOPE, YOUTUBE_ANALYTICS_SCOPE];

export const YOUTUBE_ANALYTICS_RECONNECT_MESSAGE =
  "YouTube Analytics read permission is missing. Reconnect YouTube with Google OAuth and grant Analytics access. Connections authorized before this permission was requested cannot be upgraded automatically.";

/**
 * Map a stored connections.provider value to the Google OAuth config key.
 * Database rows use "youtube"; OAuth routes/helpers use "google-youtube".
 */
export function googleOAuthConfigProvider(
  connectionProvider: string
): "google-youtube" | "google-search-console" | null {
  if (connectionProvider === YOUTUBE_CONNECTION_PROVIDER || connectionProvider === "google-youtube") {
    return "google-youtube";
  }
  if (connectionProvider === "google-search-console") return "google-search-console";
  return null;
}

export function youtubeTokenGrantsAnalytics(scope: unknown): boolean | "unknown" {
  if (typeof scope !== "string" || !scope.trim()) return "unknown";
  const granted = scope.split(/[,\s]+/).filter(Boolean);
  return granted.includes(YOUTUBE_ANALYTICS_SCOPE);
}

export class YouTubeAnalyticsAuthorizationError extends Error {
  constructor(message = YOUTUBE_ANALYTICS_RECONNECT_MESSAGE) {
    super(message);
    this.name = "YouTubeAnalyticsAuthorizationError";
  }
}

export function assertYouTubeAnalyticsAuthorized(scope: unknown) {
  if (youtubeTokenGrantsAnalytics(scope) === false) {
    throw new YouTubeAnalyticsAuthorizationError();
  }
}

export function oauthConfig(provider: OAuthProvider) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL is required for OAuth.");
  if (provider === "google-youtube" || provider === "google-search-console") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      throw new Error("Google OAuth credentials are not configured.");
    return {
      authorize: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${base}/api/oauth/callback/${provider}`,
      scopes:
        provider === "google-youtube"
          ? [...YOUTUBE_OAUTH_SCOPES]
          : ["https://www.googleapis.com/auth/webmasters.readonly"],
    };
  }
  if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET)
    throw new Error("Facebook OAuth credentials are not configured.");
  return {
    authorize: facebookOAuthDialogUrl(),
    token: facebookOAuthTokenUrl(),
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    redirectUri: `${base}/api/oauth/callback/facebook`,
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  };
}
