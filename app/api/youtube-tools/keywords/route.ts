import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { sameOriginWrite } from "@/lib/security/request";
import { generateYouTubeKeywords } from "@/lib/claude";
import type { Language } from "@/lib/claude";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(access)) return access;
  try {
    const { niche, language } = (await req.json()) as { niche?: string; language?: Language };
    if (!niche || !niche.trim()) {
      return NextResponse.json({ error: "Channel niche batana zaroori hai." }, { status: 400 });
    }
    const keywords = await generateYouTubeKeywords(niche.trim(), language || "ur");
    return NextResponse.json({ keywords });
  } catch (err) {
    console.error("youtube keywords error:", err);
    return NextResponse.json({ error: "Keywords generate nahi ho sakin." }, { status: 500 });
  }
}
