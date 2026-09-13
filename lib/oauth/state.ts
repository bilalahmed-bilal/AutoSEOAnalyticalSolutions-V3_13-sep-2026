import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import type { OAuthProvider } from "@/lib/oauth/config";
import { interpretOAuthConsume, oauthConsumeErrorMessage, type OAuthStateRow } from "@/lib/oauth/state-consume";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export {
  interpretOAuthConsume,
  oauthConsumeErrorMessage,
  type OAuthConsumeFailure,
  type OAuthStateRow,
} from "@/lib/oauth/state-consume";

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

export async function consumeOAuthState(
  raw: string,
  provider: OAuthProvider,
  expectedWorkspaceId?: string
): Promise<OAuthStateRow> {
  const stateHash = hash(raw);
  const nowIso = new Date().toISOString();
  const deleted = await supabaseAdmin<OAuthStateRow[]>(
    "oauth_states",
    { method: "DELETE", headers: { Prefer: "return=representation" } },
    `?state_hash=eq.${encodeURIComponent(stateHash)}&provider=eq.${encodeURIComponent(provider)}&expires_at=gt.${encodeURIComponent(nowIso)}`
  ).catch(() => [] as OAuthStateRow[]);

  const interpreted = interpretOAuthConsume({
    deleted: Array.isArray(deleted) ? deleted : [],
    existing: [],
    provider,
    expectedWorkspaceId,
  });
  if (interpreted.ok) return interpreted.row;

  const existing = await supabaseAdmin<Array<OAuthStateRow & { provider?: string }>>(
    "oauth_states",
    {},
    `?state_hash=eq.${encodeURIComponent(stateHash)}&select=id,workspace_id,actor_user_id,expires_at,provider&limit=1`
  ).catch(() => [] as Array<OAuthStateRow & { provider?: string }>);

  const result = interpretOAuthConsume({
    deleted: [],
    existing: Array.isArray(existing) ? existing : [],
    provider,
    expectedWorkspaceId,
  });
  if (result.ok) return result.row;
  throw new Error(oauthConsumeErrorMessage(result.reason));
}
