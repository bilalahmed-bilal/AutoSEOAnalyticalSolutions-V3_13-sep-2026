import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/claude";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  try {
    // Reuse the same aggregation the Analytics tab uses, via an internal fetch
    const { origin } = new URL(req.url);
    const analyticsRes = await fetch(`${origin}/api/analytics`, {
      headers: {
        Authorization: req.headers.get("authorization") || "",
        "x-workspace-id": req.headers.get("x-workspace-id") || "",
      },
      cache: "no-store",
    });
    const analyticsData = await analyticsRes.json();

    const report = await generateReport(analyticsData);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("report error:", err);
    return NextResponse.json({ error: "Report generate nahi ho saka." }, { status: 500 });
  }
}
