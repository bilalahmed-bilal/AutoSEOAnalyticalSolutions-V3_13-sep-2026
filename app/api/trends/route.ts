import { NextRequest, NextResponse } from "next/server";
import { generateTrendIdeas } from "@/lib/claude";
import type { Language } from "@/lib/claude";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function POST(req: NextRequest) {
  const entitled = await requireProductAccess(req, {
    feature: "keywords.research",
    minRole: "editor",
    usageMetric: "ai.generations",
  });
  if (!isProductAccess(entitled)) return entitled;
  try {
    const { niche, language } = (await req.json()) as { niche?: string; language?: Language };
    if (!niche || !niche.trim()) {
      return NextResponse.json({ error: "Niche is required." }, { status: 400 });
    }
    const ideas = await generateTrendIdeas(niche.trim(), language || "ur");
    await entitled.consume();
    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("trends error:", err);
    return NextResponse.json({ error: "Trend ideas could not be generated." }, { status: 500 });
  }
}
