import { NextRequest, NextResponse } from "next/server";
import { generateSeoFixes } from "@/lib/claude";
import type { CrawlResult } from "@/lib/seo-crawler";
import type { SeoAnalysis } from "@/lib/claude";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function POST(req: NextRequest) {
  const entitled = await requireProductAccess(req, {
    feature: "website_seo.technical",
    minRole: "viewer",
    usageMetric: "ai.generations",
  });
  if (!isProductAccess(entitled)) return entitled;
  try {
    const { crawl, analysis } = (await req.json()) as {
      crawl: CrawlResult;
      analysis: SeoAnalysis;
    };
    if (!crawl || !analysis) {
      return NextResponse.json({ error: "Crawl and analysis data are required." }, { status: 400 });
    }
    const fixes = await generateSeoFixes(crawl, analysis);
    await entitled.consume();
    return NextResponse.json({ fixes });
  } catch (err) {
    console.error("seo-fixes error:", err);
    return NextResponse.json({ error: "SEO fixes could not be generated." }, { status: 500 });
  }
}
