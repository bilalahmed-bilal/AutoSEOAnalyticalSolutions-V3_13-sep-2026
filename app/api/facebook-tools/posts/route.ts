import { NextResponse } from "next/server";
import { getPublishSettings } from "@/lib/store";
import { getFacebookPageStats, getFacebookRecentPosts } from "@/lib/analytics/facebook";
import { flagUnderperforming } from "@/lib/analytics/audit";
import { errorMessage } from "@/lib/unknown";

export async function GET() {
  try {
    const settings = getPublishSettings();
    if (!settings.facebook) {
      return NextResponse.json({ error: "Pehle Publish tab mein Facebook connect karein." }, { status: 400 });
    }
    const pageStats = await getFacebookPageStats(settings.facebook.settings);
    const posts = await getFacebookRecentPosts(settings.facebook.settings, 25);
    const audited = flagUnderperforming(posts, (p) => p.likeCount + p.commentCount + p.shareCount);
    return NextResponse.json({ pageStats, posts: audited });
  } catch (err: unknown) {
    console.error("fb posts error:", err);
    return NextResponse.json({ error: errorMessage(err, "Posts fetch nahi ho sakay.") }, { status: 500 });
  }
}
