import { NextRequest, NextResponse } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { sameOriginWrite } from "@/lib/security/request";
import { fetchRetentionInsights } from "@/lib/publishers/youtube";
import { errorMessage } from "@/lib/unknown";
import { YouTubeAnalyticsAuthorizationError } from "@/lib/oauth/config";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireYouTubeAccess(req, "viewer", "youtube.analytics");
  if (!isYouTubeSecurityContext(access)) return access;
  try {
    const { videoId } = (await req.json()) as { videoId?: string };
    if (!videoId) return NextResponse.json({ error: "Video ID is required." }, { status: 400 });

    const insights = await fetchRetentionInsights(access.settings, videoId);
    return NextResponse.json({ insights });
  } catch (err: unknown) {
    console.error("retention error:", err);
    const status = err instanceof YouTubeAnalyticsAuthorizationError ? 403 : 500;
    return NextResponse.json({ error: errorMessage(err, "Could not load retention data.") }, { status });
  }
}
