import { NextRequest, NextResponse } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { sameOriginWrite } from "@/lib/security/request";
import { fetchVideoSnippet } from "@/lib/publishers/youtube";
import { generateYouTubeSeoFix } from "@/lib/claude";
import type { Language } from "@/lib/claude";
import { errorMessage } from "@/lib/unknown";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireYouTubeAccess(req, "editor");
  if (!isYouTubeSecurityContext(access)) return access;
  try {
    const { videoId, niche, language } = (await req.json()) as {
      videoId?: string;
      niche?: string;
      language?: Language;
    };
    if (!videoId || !niche) {
      return NextResponse.json({ error: "Video ID aur niche dono zaroori hain." }, { status: 400 });
    }

    const existing = await fetchVideoSnippet(access.settings, videoId);
    const fix = await generateYouTubeSeoFix(existing, niche, language || "ur");

    return NextResponse.json({ existing, fix });
  } catch (err: unknown) {
    console.error("youtube seo-fix error:", err);
    return NextResponse.json({ error: errorMessage(err, "SEO fix generate nahi ho saka.") }, { status: 500 });
  }
}
