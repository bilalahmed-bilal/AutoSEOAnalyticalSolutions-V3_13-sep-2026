import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { generateSeoFixes } from "@/lib/claude";
import type { CrawlResult } from "@/lib/seo-crawler";
import type { SeoAnalysis } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  try {
    const { crawl, analysis } = (await req.json()) as {
      crawl: CrawlResult;
      analysis: SeoAnalysis;
    };
    if (!crawl || !analysis) {
      return NextResponse.json({ error: "Crawl aur analysis data chahiye." }, { status: 400 });
    }
    const fixes = await generateSeoFixes(crawl, analysis);
    return NextResponse.json({ fixes });
  } catch (err) {
    console.error("seo-fixes error:", err);
    return NextResponse.json({ error: "Fixes generate nahi ho sakin." }, { status: 500 });
  }
}
