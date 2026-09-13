import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { crawlPage } from "@/lib/seo-crawler";
import { analyzeKeyword } from "@/lib/keyword-intelligence";
import { writeAudit } from "@/lib/security/audit";
import { errorMessage } from "@/lib/unknown";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const entitled = await requireProductAccess(req, {
    feature: "keywords.research",
    minRole: "viewer",
    usageMetric: "keywords.research",
  });
  if (!isProductAccess(entitled)) return entitled;
  const access = entitled.access;
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
    await entitled.consume();
    return NextResponse.json({ crawl, intelligence });
  } catch (err: unknown) {
    console.error("keyword intelligence error:", err);
    return NextResponse.json({ error: errorMessage(err, "Keyword analysis failed.") }, { status: 400 });
  }
}
