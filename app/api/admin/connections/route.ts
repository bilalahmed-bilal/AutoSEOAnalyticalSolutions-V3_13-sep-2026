import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "connections",
    {},
    "?select=id,workspace_id,provider,status,display_name,created_at,updated_at,token_expires_at,last_token_refresh_at&order=created_at.desc&limit=300"
  ).catch(() => []);
  return NextResponse.json({
    connections: rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      status: row.status,
      displayName: row.display_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tokenExpiresAt: row.token_expires_at,
      lastTokenRefreshAt: row.last_token_refresh_at,
    })),
  });
}
