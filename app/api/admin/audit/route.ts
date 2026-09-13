import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "audit_logs",
    {},
    "?select=id,workspace_id,actor_user_id,action,entity_type,entity_id,metadata,created_at&order=created_at.desc&limit=200"
  ).catch(() => []);
  return NextResponse.json({ logs: rows });
}
