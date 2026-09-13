import { NextRequest, NextResponse } from "next/server";
import { generateVariants } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ variants });
  } catch (err) {
    console.error("fb post-ab error:", err);
    return NextResponse.json({ error: "Variants generate nahi ho sakay." }, { status: 500 });
  }
}
