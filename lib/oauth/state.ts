import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import type { OAuthProvider } from "@/lib/oauth/config";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createOAuthState(provider: OAuthProvider, workspaceId: string, userId: string) {
  const raw = randomBytes(32).toString("base64url");
  await supabaseAdmin("oauth_states", {
    method: "POST",
    body: JSON.stringify({
      state_hash: hash(raw),
      provider,
      workspace_id: workspaceId,
      actor_user_id: userId,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    }),
    headers: { Prefer: "return=minimal" },
  });
  return raw;
}

export async function consumeOAuthState(raw: string, provider: OAuthProvider) {
  const rows = await supabaseAdmin<
    Array<{ id: string; workspace_id: string; actor_user_id: string; expires_at: string }>
  >(
    "oauth_states",
    {},
    `?state_hash=eq.${encodeURIComponent(hash(raw))}&provider=eq.${encodeURIComponent(provider)}&limit=1`
  );
  const row = rows[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now())
    throw new Error("OAuth state invalid ya expire ho gaya hai.");
  await supabaseAdmin("oauth_states", { method: "DELETE" }, `?id=eq.${encodeURIComponent(row.id)}`);
  return row;
}
