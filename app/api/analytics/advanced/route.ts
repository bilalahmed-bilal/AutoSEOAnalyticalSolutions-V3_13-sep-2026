import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { buildAdvancedAnalytics } from "@/lib/analytics/advanced";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated)
    return NextResponse.json({ error: "Advanced analytics require authenticated Supabase mode." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  try {
    return NextResponse.json(
      await buildAdvancedAnalytics(
        req,
        tenant.workspaceId,
        req.nextUrl.searchParams.get("startDate") || undefined,
        req.nextUrl.searchParams.get("endDate") || undefined
      )
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, "Advanced analytics failed.") }, { status: 502 });
  }
}
