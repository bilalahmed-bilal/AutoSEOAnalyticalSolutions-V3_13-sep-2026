import { NextRequest } from "next/server";
import { getAuthenticatedUser, type AuthUser } from "@/lib/auth/supabase";
import { supabaseAdmin } from "@/lib/db/supabase-rest";

export interface TenantContext {
  user: AuthUser;
  workspaceId: string;
}

/**
 * Resolves a workspace only after authenticating the caller.
 * The database/RLS layer remains the final authorization boundary.
 */
export async function getTenantContext(req: NextRequest): Promise<TenantContext | null> {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  const workspaceId = req.headers.get("x-workspace-id")?.trim();
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;

  // Never trust the workspace header by itself. Confirm membership server-side.
  const members = await supabaseAdmin<Array<{ user_id: string }>>(
    "workspace_members",
    {},
    `?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
  );
  if (!members.length) return null;

  return { user, workspaceId };
}
