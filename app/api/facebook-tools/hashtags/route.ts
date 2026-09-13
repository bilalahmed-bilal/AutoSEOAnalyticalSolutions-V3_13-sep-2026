import { NextRequest, NextResponse } from "next/server";
import { generateFacebookHashtags } from "@/lib/claude";
import type { Language } from "@/lib/claude";
import { sameOriginWrite } from "@/lib/security/request";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, {
    feature: "content.generate",
    minRole: "editor",
    usageMetric: "ai.generations",
  });
  if (!isProductAccess(entitled)) return entitled;
  try {
    const { niche, language } = (await req.json()) as { niche?: string; language?: Language };
    if (!niche?.trim()) return NextResponse.json({ error: "Niche batana zaroori hai." }, { status: 400 });
    const hashtags = await generateFacebookHashtags(niche.trim(), language || "ur");
    await entitled.consume();
    return NextResponse.json({ hashtags, limitation: "GENERATION_ONLY" });
  } catch {
    return NextResponse.json({ error: "Hashtags generate nahi ho sakay." }, { status: 500 });
  }
}
