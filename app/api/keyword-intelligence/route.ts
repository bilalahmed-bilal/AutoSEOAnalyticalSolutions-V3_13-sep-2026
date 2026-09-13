import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { crawlPage } from "@/lib/seo-crawler";
import { analyzeKeyword } from "@/lib/keyword-intelligence";
import { writeAudit } from "@/lib/security/audit";
import { errorMessage } from "@/lib/unknown";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const rate = checkRateLimit(req, "keyword-intelligence");
  if (!rate.ok)
    return NextResponse.json(
      { error: "Too many keyword analysis requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  try {
    const body = (await req.json()) as { url?: string; keyword?: string };
    if (!body.url?.trim() || !body.keyword?.trim())
      return NextResponse.json({ error: "URL and target keyword are required." }, { status: 400 });
    const crawl = await crawlPage(body.url.trim());
    const intelligence = analyzeKeyword(crawl, body.keyword.trim());
    writeAudit({
      action: "seo_analysis",
      actor: access.user?.id || "anonymous-local",
      metadata: { url: crawl.url, keyword: body.keyword.trim(), score: intelligence.score },
    });
    return NextResponse.json({ crawl, intelligence });
  } catch (err: unknown) {
    console.error("keyword intelligence error:", err);
    return NextResponse.json({ error: errorMessage(err, "Keyword analysis failed.") }, { status: 400 });
  }
}
