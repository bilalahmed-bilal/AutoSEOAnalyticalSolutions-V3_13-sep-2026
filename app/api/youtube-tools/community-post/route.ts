import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { sameOriginWrite } from "@/lib/security/request";
import { generateCommunityPost } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(access)) return access;
  try {
    const { topic, profile, language } = (await req.json()) as {
      topic?: string;
      profile?: BusinessProfile;
      language?: Language;
    };
    if (!topic || !profile) {
      return NextResponse.json({ error: "Topic aur business profile zaroori hain." }, { status: 400 });
    }
    const post = await generateCommunityPost(topic, profile, language || "ur");
    return NextResponse.json({ post });
  } catch (err) {
    console.error("community post error:", err);
    return NextResponse.json({ error: "Post generate nahi ho saka." }, { status: 500 });
  }
}
