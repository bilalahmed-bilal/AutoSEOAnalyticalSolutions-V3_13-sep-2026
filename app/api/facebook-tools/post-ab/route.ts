import { NextRequest, NextResponse } from "next/server";
import { generateVariants } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";
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
    const { topic, profile, language } = (await req.json()) as {
      topic?: string;
      profile?: BusinessProfile;
      language?: Language;
    };
    if (!topic || !profile) {
      return NextResponse.json({ error: "Topic aur business profile zaroori hain." }, { status: 400 });
    }
    const variants = await generateVariants({
      channel: "facebook",
      language: language || "ur",
      topic,
      profile,
    });
    await entitled.consume();
    return NextResponse.json({ variants, limitation: "GENERATION_ONLY" });
  } catch {
    return NextResponse.json({ error: "Variants generate nahi ho sakay." }, { status: 500 });
  }
}
