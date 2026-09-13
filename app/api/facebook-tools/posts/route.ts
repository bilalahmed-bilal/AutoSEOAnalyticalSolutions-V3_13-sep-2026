import { NextRequest, NextResponse } from "next/server";
import { isFacebookSecurityContext, requireFacebookAccess } from "@/lib/facebook-security";
import { getFacebookPageStats, getFacebookRecentPosts } from "@/lib/analytics/facebook";
import { flagUnderperforming } from "@/lib/analytics/audit";
import { errorMessage } from "@/lib/unknown";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function GET(req: NextRequest) {
  const entitled = await requireProductAccess(req, { feature: "facebook.analytics", minRole: "viewer" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "viewer");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const pageStats = await getFacebookPageStats(access.settings);
    const posts = await getFacebookRecentPosts(access.settings, 25);
    const audited = flagUnderperforming(posts, (p) => p.likeCount + p.commentCount + p.shareCount);
    return NextResponse.json({ pageStats, posts: audited });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, "Posts fetch nahi ho sakay.") }, { status: 500 });
  }
}
