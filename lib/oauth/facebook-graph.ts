/**
 * Meta Graph API version helper.
 *
 * v20.0 is removed on 24 Sep 2026. Production paths default to v26.0,
 * the current Graph API version as of this release.
 *
 * FACEBOOK_GRAPH_VERSION remains an override for controlled testing.
 * Invalid values fall back to the supported default.
 */
export const DEFAULT_FACEBOOK_GRAPH_VERSION = "v26.0";
export const FACEBOOK_GRAPH_HOST = "https://graph.facebook.com";
export const FACEBOOK_OAUTH_HOST = "https://www.facebook.com";

const VERSION_PATTERN = /^v(\d+)\.(\d+)$/;

export function facebookGraphVersion(
  env?: { FACEBOOK_GRAPH_VERSION?: string | undefined } | NodeJS.ProcessEnv
): string {
  const source = env || process.env;
  const raw = (source.FACEBOOK_GRAPH_VERSION || DEFAULT_FACEBOOK_GRAPH_VERSION).trim();
  const match = VERSION_PATTERN.exec(raw);
  if (!match) return DEFAULT_FACEBOOK_GRAPH_VERSION;
  const major = Number(match[1]);
  if (!Number.isFinite(major) || major <= 20) return DEFAULT_FACEBOOK_GRAPH_VERSION;
  return raw;
}

export function facebookGraphApiBase(
  env?: { FACEBOOK_GRAPH_VERSION?: string | undefined } | NodeJS.ProcessEnv
): string {
  return `${FACEBOOK_GRAPH_HOST}/${facebookGraphVersion(env)}`;
}

export function facebookOAuthDialogUrl(
  env?: { FACEBOOK_GRAPH_VERSION?: string | undefined } | NodeJS.ProcessEnv
): string {
  return `${FACEBOOK_OAUTH_HOST}/${facebookGraphVersion(env)}/dialog/oauth`;
}

export function facebookOAuthTokenUrl(
  env?: { FACEBOOK_GRAPH_VERSION?: string | undefined } | NodeJS.ProcessEnv
): string {
  return `${facebookGraphApiBase(env)}/oauth/access_token`;
}
