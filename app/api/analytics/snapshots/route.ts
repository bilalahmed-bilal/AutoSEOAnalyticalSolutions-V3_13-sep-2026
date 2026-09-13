import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated)
    return NextResponse.json({ error: "Analytics snapshots require authenticated Supabase mode." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "analytics_snapshots",
    {},
    `?workspace_id=eq.${encodeURIComponent(tenant.workspaceId)}&order=period_start.desc&limit=100`
  );
  return NextResponse.json({ snapshots: rows });
}
