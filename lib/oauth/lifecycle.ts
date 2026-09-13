import { googleOAuthConfigProvider, oauthConfig } from "@/lib/oauth/config";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function refreshConnectionIfNeeded(connection: UnknownRecord): Promise<UnknownRecord> {
  const credentials = JSON.parse(decryptSecret(String(connection.encrypted_credentials)));
  const oauthProvider = googleOAuthConfigProvider(String(connection.provider || ""));
  if (!oauthProvider) return credentials;

  const expiresAt = Number(
    credentials.expiresAt || (connection.token_expires_at ? Date.parse(connection.token_expires_at) : 0)
  );
  if (!credentials.refreshToken || (expiresAt && expiresAt > Date.now() + 120_000)) return credentials;

  const c = oauthConfig(oauthProvider);
  const res = await fetch(c.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error("Google OAuth token refresh failed.");

  const updated = {
    ...credentials,
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    ...(typeof data.scope === "string" && data.scope.trim() ? { scope: data.scope } : {}),
  };
  await supabaseAdmin(
    "connections",
    {
      method: "PATCH",
      body: JSON.stringify({
        encrypted_credentials: encryptSecret(JSON.stringify(updated)),
        token_expires_at: new Date(updated.expiresAt).toISOString(),
        last_token_refresh_at: new Date().toISOString(),
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    },
    `?id=eq.${encodeURIComponent(connection.id)}`
  );
  return updated;
}

export async function markConnectionHealth(connectionId: string, ok: boolean, message: string) {
  await supabaseAdmin(
    "connections",
    {
      method: "PATCH",
      body: JSON.stringify({
        status: ok ? "active" : "error",
        last_checked_at: new Date().toISOString(),
        last_error: ok ? null : message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    },
    `?id=eq.${encodeURIComponent(connectionId)}`
  );
}
