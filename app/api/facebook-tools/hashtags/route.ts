import { NextRequest, NextResponse } from "next/server";
import { generateFacebookHashtags } from "@/lib/claude";
import type { Language } from "@/lib/claude";
import { sameOriginWrite } from "@/lib/security/request";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, {
    feature: "content.generate",
    minRole: "editor",
    usageMetric: "ai.generations",
  });
  if (!isProductAccess(entitled)) return entitled;
  const rate = checkRateLimit(req, "ai-generate");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many generation requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  try {
    const { niche, language } = (await req.json()) as { niche?: string; language?: Language };
    if (!niche?.trim()) return NextResponse.json({ error: "A niche is required." }, { status: 400 });
    const hashtags = await generateFacebookHashtags(niche.trim(), language || "en");
    await entitled.consume();
    return NextResponse.json({ hashtags, limitation: "GENERATION_ONLY" });
  } catch {
    return NextResponse.json({ error: "Hashtags could not be generated." }, { status: 500 });
  }
}
