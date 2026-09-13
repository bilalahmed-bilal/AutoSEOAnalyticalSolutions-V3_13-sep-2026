import { NextRequest, NextResponse } from "next/server";
import { isFacebookSecurityContext, requireFacebookAccess } from "@/lib/facebook-security";
import { fetchAudienceInsights } from "@/lib/publishers/facebook";
import { errorMessage } from "@/lib/unknown";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function GET(req: NextRequest) {
  const entitled = await requireProductAccess(req, { feature: "facebook.analytics", minRole: "viewer" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "viewer");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const insights = await fetchAudienceInsights(access.settings);
    return NextResponse.json({ insights });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, "Insights fetch nahi ho sakay.") }, { status: 500 });
  }
}
