import { NextRequest, NextResponse } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { sameOriginWrite } from "@/lib/security/request";
import { getYouTubePerformanceReport } from "@/lib/analytics/youtube-deep";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireYouTubeAccess(req, "viewer");
  if (!isYouTubeSecurityContext(access)) return access;
  try {
    const startDate = req.nextUrl.searchParams.get("startDate") || undefined;
    const endDate = req.nextUrl.searchParams.get("endDate") || undefined;
    return NextResponse.json(await getYouTubePerformanceReport(access.settings, { startDate, endDate }));
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, "YouTube performance intelligence failed.") },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  return GET(req);
}
