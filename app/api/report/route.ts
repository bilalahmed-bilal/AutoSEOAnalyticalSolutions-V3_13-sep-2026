import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/claude";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function GET(req: NextRequest) {
  const entitled = await requireProductAccess(req, { feature: "website_seo.audit", minRole: "viewer" });
  if (!isProductAccess(entitled)) return entitled;
  try {
    const { origin } = new URL(req.url);
    const analyticsRes = await fetch(`${origin}/api/analytics`, {
      headers: {
        Authorization: req.headers.get("authorization") || "",
        "x-workspace-id": req.headers.get("x-workspace-id") || "",
        cookie: req.headers.get("cookie") || "",
      },
      cache: "no-store",
    });
    const analyticsData = await analyticsRes.json();
    const report = await generateReport(analyticsData);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("report error:", err);
    return NextResponse.json({ error: "Report could not be generated." }, { status: 500 });
  }
}
