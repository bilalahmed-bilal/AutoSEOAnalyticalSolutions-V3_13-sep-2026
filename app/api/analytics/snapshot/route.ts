import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { getSearchConsoleConnection, getSearchConsoleSummary } from "@/lib/analytics/search-console";
import { supabaseAdmin } from "@/lib/db/supabase-rest";

function dateOnly(d: Date) { return d.toISOString().slice(0, 10); }

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ error: "Analytics snapshots require authenticated Supabase mode." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const end = typeof body.endDate === "string" ? body.endDate : dateOnly(new Date(Date.now() - 86_400_000));
  const start = typeof body.startDate === "string" ? body.startDate : dateOnly(new Date(Date.now() - 28 * 86_400_000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return NextResponse.json({ error: "Valid startDate/endDate required." }, { status: 400 });
  const connection = await getSearchConsoleConnection(tenant.workspaceId);
  if (!connection) return NextResponse.json({ error: "Google Search Console connection not configured." }, { status: 404 });
  try {
    const summary = await getSearchConsoleSummary(connection.credentials, start, end);
    await supabaseAdmin("analytics_snapshots", { method: "POST", body: JSON.stringify({ workspace_id: tenant.workspaceId, provider: "google-search-console", period_start: start, period_end: end, metrics: summary }), headers: { Prefer: "resolution=merge-duplicates,return=representation" } }, "?on_conflict=workspace_id,provider,period_start,period_end");
    return NextResponse.json({ snapshot: summary });
  } catch (e: any) { return NextResponse.json({ error: e?.message || "Search Console snapshot failed." }, { status: 502 }); }
}
