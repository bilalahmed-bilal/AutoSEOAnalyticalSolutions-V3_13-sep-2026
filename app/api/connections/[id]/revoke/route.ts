import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { decryptSecret } from "@/lib/security/secrets";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const { id } = await params;
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "connections",
    {},
    `?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(tenant.workspaceId)}&limit=1`
  );
  const connection = rows[0];
  if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

  let revokeMessage = "Provider revocation completed.";
  try {
    const credentials = decryptSecret(String(connection.encrypted_credentials));
    if (connection.provider === "youtube") {
      const data = JSON.parse(credentials);
      if (data.accessToken) {
        const url = new URL("https://oauth2.googleapis.com/revoke");
        url.searchParams.set("token", data.accessToken);
        const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000) });
        if (!res.ok && res.status !== 400) throw new Error(`Google revoke failed (${res.status}).`);
      }
    }
  } catch (error: unknown) {
    revokeMessage = `Local disconnect completed; provider revoke warning: ${String(errorMessage(error, "unknown error"))}`;
  }

  await supabaseAdmin(
    "connections",
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "revoked",
        encrypted_credentials: "revoked",
        last_error: null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    },
    `?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(tenant.workspaceId)}`
  );
  return NextResponse.json({ ok: true, message: revokeMessage });
}
