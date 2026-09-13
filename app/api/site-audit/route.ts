import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { crawlSite } from "@/lib/seo-crawler";
import { calculateSiteSeoScore } from "@/lib/seo-site-engine";
import { writeAudit } from "@/lib/security/audit";
import { errorMessage } from "@/lib/unknown";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const rate = checkRateLimit(req, "site-audit");
  if (!rate.ok)
    return NextResponse.json(
      { error: "Too many site audit requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );

  try {
    const body = (await req.json()) as { url?: string; maxPages?: number };
    if (!body.url?.trim()) return NextResponse.json({ error: "URL is required." }, { status: 400 });
    const maxPages = Math.min(50, Math.max(1, Number(body.maxPages) || 25));
    const crawl = await crawlSite(body.url.trim(), maxPages);
    const seo = calculateSiteSeoScore(crawl);
    writeAudit({
      action: "site_audit",
      actor: access.user?.id || "anonymous-local",
      metadata: { url: crawl.startUrl, pages: crawl.pages.length, score: seo.score },
    });
    return NextResponse.json({ crawl, seo });
  } catch (err: unknown) {
    console.error("site audit error:", err);
    return NextResponse.json({ error: errorMessage(err, "Site audit failed.") }, { status: 400 });
  }
}
