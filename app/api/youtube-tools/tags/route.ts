import { NextRequest, NextResponse } from "next/server";
import { sameOriginWrite } from "@/lib/security/request";
import { generateYouTubeTags } from "@/lib/claude";
import type { Language } from "@/lib/claude";
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
    const { topic, language } = (await req.json()) as { topic?: string; language?: Language };
    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Video topic is required." }, { status: 400 });
    }
    const tags = await generateYouTubeTags(topic.trim(), language || "en");
    await entitled.consume();
    return NextResponse.json({ tags });
  } catch (err) {
    console.error("youtube tags error:", err);
    return NextResponse.json({ error: "Tags could not be generated." }, { status: 500 });
  }
}
