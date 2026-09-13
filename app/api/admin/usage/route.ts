import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim();
  const query = workspaceId
    ? `?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,metric,period,quantity,updated_at&order=updated_at.desc&limit=400`
    : "?select=workspace_id,metric,period,quantity,updated_at&order=updated_at.desc&limit=400";
  const rows = await supabaseAdmin<UnknownRecord[]>("usage_counters", {}, query).catch(() => []);
  return NextResponse.json({
    counters: rows,
    note: rows.length
      ? "Live usage_counters rows."
      : "No usage_counters rows. Apply supabase/v46-nexora-saas.sql for durable metering.",
  });
}
