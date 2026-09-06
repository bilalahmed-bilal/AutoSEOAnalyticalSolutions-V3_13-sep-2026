import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { buildAttributionReport } from "@/lib/analytics/attribution";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ error: "Attribution requires authenticated Supabase mode." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const draftId = req.nextUrl.searchParams.get("draftId")?.trim();
  const targetUrl = req.nextUrl.searchParams.get("targetUrl")?.trim();
  if (!draftId || !targetUrl) return NextResponse.json({ error: "draftId and targetUrl are required." }, { status: 400 });
  try { return NextResponse.json(await buildAttributionReport(tenant.workspaceId, draftId, targetUrl)); }
  catch (e: any) { return NextResponse.json({ error: e?.message || "Attribution report failed." }, { status: 502 }); }
}
