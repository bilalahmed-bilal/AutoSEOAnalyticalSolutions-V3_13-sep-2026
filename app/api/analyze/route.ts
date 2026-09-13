import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { crawlPage } from "@/lib/seo-crawler";
import { analyzeSeo } from "@/lib/claude";
import { recordSeoScoreRemote } from "@/lib/store-repository";
import { getTenantContext } from "@/lib/tenant";
import { calculateDeterministicSeoScore } from "@/lib/seo-engine";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { writeAudit } from "@/lib/security/audit";
import { errorMessage } from "@/lib/unknown";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const rate = checkRateLimit(req, "seo-analyze");
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many analysis requests. Thori dair baad dobara try karein." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || !url.trim()) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    const crawl = await crawlPage(url.trim());
    const deterministic = calculateDeterministicSeoScore(crawl);

    // AI is intentionally an interpretation layer. The numeric score is based
    // on deterministic checks so repeated analyses remain explainable and stable.
    let analysis;
    try {
      analysis = await analyzeSeo(crawl);
    } catch (aiError) {
      console.error("AI SEO interpretation failed:", aiError);
      analysis = {
        score: deterministic.score,
        summary: "Deterministic technical SEO checks complete ho gaye hain.",
        issues: deterministic.issues.map(({ severity, issue, fix }) => ({ severity, issue, fix })),
      };
    }

    const merged = {
      ...analysis,
      score: deterministic.score,
      issues: [
        ...deterministic.issues.map(({ severity, issue, fix }) => ({ severity, issue, fix })),
        ...analysis.issues.filter((aiIssue) => !deterministic.issues.some((rule) => rule.issue === aiIssue.issue)),
      ],
      deterministic,
      aiScore: analysis.score,
    };

    await recordSeoScoreRemote(
      { req, workspaceId: tenant?.workspaceId },
      crawl.url,
      merged.score,
      deterministic.score,
      analysis.score
    );
    writeAudit({
      action: "seo_analysis",
      actor: "anonymous-local",
      metadata: { url: crawl.url, score: merged.score },
    });

    return NextResponse.json({ crawl, analysis: merged });
  } catch (err: unknown) {
    console.error("analyze error:", err);
    const detail = errorMessage(err, "");
    const message = /private|reserved|local|not allowed|too large|redirect/i.test(detail)
      ? detail
      : /fetch failed/i.test(detail) || (err instanceof Error && err.name === "TimeoutError")
        ? "Website tak nahi pahunch paye. URL check karein aur dobara koshish karein."
        : "SEO analysis fail ho gaya. Dobara koshish karein.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
