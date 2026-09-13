import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { sameOriginWrite } from "@/lib/security/request";
import { generateYouTubeTags } from "@/lib/claude";
import type { Language } from "@/lib/claude";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(access)) return access;
  try {
    const { topic, language } = (await req.json()) as { topic?: string; language?: Language };
    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Video topic batana zaroori hai." }, { status: 400 });
    }
    const tags = await generateYouTubeTags(topic.trim(), language || "ur");
    return NextResponse.json({ tags });
  } catch (err) {
    console.error("youtube tags error:", err);
    return NextResponse.json({ error: "Tags generate nahi ho sakay." }, { status: 500 });
  }
}
