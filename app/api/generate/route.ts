import { NextRequest, NextResponse } from "next/server";
import { generateContent, GenerateContentInput } from "@/lib/claude";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { readJsonBody } from "@/lib/security/public-error";

export async function POST(req: NextRequest) {
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
    const parsed = await readJsonBody<GenerateContentInput>(req, 64_000);
    if (!parsed.ok) return parsed.response;
    const input = parsed.value;

    if (!input.channel || !input.language || !input.topic || !input.profile) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const content = await generateContent(input);
    await entitled.consume();
    return NextResponse.json({ content });
  } catch (err) {
    console.error("generate-content error:", err);
    return NextResponse.json({ error: "Content generation failed. Please try again." }, { status: 500 });
  }
}
