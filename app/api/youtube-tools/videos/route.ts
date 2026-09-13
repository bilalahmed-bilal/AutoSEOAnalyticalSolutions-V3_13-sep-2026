import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { listChannelVideos } from "@/lib/publishers/youtube";
import { flagUnderperforming } from "@/lib/analytics/audit";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  try {
    const access = await requireYouTubeAccess(req, "viewer");
    if (!isYouTubeSecurityContext(access)) return access;
    const videos = await listChannelVideos(access.settings, 25);
    const audited = flagUnderperforming(videos, (v) => v.viewCount);
    return NextResponse.json({ videos: audited });
  } catch (err: unknown) {
    console.error("youtube videos error:", err);
    return NextResponse.json({ error: errorMessage(err, "Videos fetch nahi ho sakin.") }, { status: 500 });
  }
}
