import { NextRequest, NextResponse } from "next/server";
import { generateFacebookHashtags } from "@/lib/claude";
import type { Language } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { niche, language } = (await req.json()) as { niche?: string; language?: Language };
    if (!niche || !niche.trim()) {
      return NextResponse.json({ error: "Niche batana zaroori hai." }, { status: 400 });
    }
    const hashtags = await generateFacebookHashtags(niche.trim(), language || "ur");
    return NextResponse.json({ hashtags });
  } catch (err) {
    console.error("fb hashtags error:", err);
    return NextResponse.json({ error: "Hashtags generate nahi ho sakay." }, { status: 500 });
  }
}
