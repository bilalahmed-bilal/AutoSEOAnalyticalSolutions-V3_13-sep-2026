export type OAuthStateRow = {
  id: string;
  workspace_id: string;
  actor_user_id: string;
  expires_at: string;
  provider?: string;
};

export type OAuthConsumeFailure = "invalid" | "expired" | "replayed" | "wrong_provider" | "wrong_workspace";

export function interpretOAuthConsume(input: {
  deleted: OAuthStateRow[];
  existing: Array<OAuthStateRow & { provider?: string }>;
  provider: string;
  expectedWorkspaceId?: string;
  now?: number;
}): { ok: true; row: OAuthStateRow } | { ok: false; reason: OAuthConsumeFailure } {
  const now = input.now ?? Date.now();
  const row = input.deleted[0];
  if (row) {
    if (input.expectedWorkspaceId && row.workspace_id !== input.expectedWorkspaceId) {
      return { ok: false, reason: "wrong_workspace" };
    }
    return { ok: true, row };
  }
  const existing = input.existing[0];
  if (!existing) return { ok: false, reason: "replayed" };
  if (existing.provider && existing.provider !== input.provider) return { ok: false, reason: "wrong_provider" };
  if (new Date(existing.expires_at).getTime() < now) return { ok: false, reason: "expired" };
  if (input.expectedWorkspaceId && existing.workspace_id !== input.expectedWorkspaceId) {
    return { ok: false, reason: "wrong_workspace" };
  }
  return { ok: false, reason: "invalid" };
}

export function oauthConsumeErrorMessage(reason: OAuthConsumeFailure) {
  if (reason === "expired") return "OAuth state expired. Start the connection again.";
  if (reason === "replayed") return "OAuth state was already used. Start the connection again.";
  if (reason === "wrong_provider") return "OAuth state does not match this provider.";
  if (reason === "wrong_workspace") return "OAuth state does not match this workspace.";
  return "OAuth state is invalid. Start the connection again.";
}
