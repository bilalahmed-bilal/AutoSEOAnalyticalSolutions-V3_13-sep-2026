import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { getSearchConsoleConnection, listSearchConsoleSites } from "@/lib/analytics/search-console";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated)
    return NextResponse.json({ error: "Search Console requires authenticated Supabase mode." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const connection = await getSearchConsoleConnection(tenant.workspaceId);
  if (!connection) return NextResponse.json({ connected: false, sites: [] });
  try {
    return NextResponse.json({
      connected: true,
      sites: await listSearchConsoleSites(connection.credentials.accessToken),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { connected: true, sites: [], error: errorMessage(e, "Search Console request failed.") },
      { status: 502 }
    );
  }
}
