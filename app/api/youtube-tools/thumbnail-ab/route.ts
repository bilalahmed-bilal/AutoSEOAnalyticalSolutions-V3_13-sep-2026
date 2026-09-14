import { NextRequest, NextResponse } from "next/server";
import { sameOriginWrite } from "@/lib/security/request";
import { generateVariants } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, {
    feature: "youtube.seo",
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
    const { topic, profile, language } = (await req.json()) as {
      topic?: string;
      profile?: BusinessProfile;
      language?: Language;
    };
    if (!topic || !profile) {
      return NextResponse.json({ error: "Topic and business profile are required." }, { status: 400 });
    }
    const variants = await generateVariants({
      channel: "youtube",
      language: language || "en",
      topic,
      profile,
    });
    await entitled.consume();
    return NextResponse.json({
      variants,
      capability: "GENERATION_ONLY",
      note: "Thumbnail image generation is not implemented. Title variants are generated for review.",
    });
  } catch (err) {
    console.error("thumbnail-ab error:", err);
    return NextResponse.json({ error: "Variants could not be generated." }, { status: 500 });
  }
}
