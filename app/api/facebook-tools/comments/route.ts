import { NextRequest, NextResponse } from "next/server";
import { isFacebookSecurityContext, requireFacebookAccess } from "@/lib/facebook-security";
import { fetchPostComments, replyToComment } from "@/lib/publishers/facebook";
import { generateCommentReply } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";
import { errorMessage } from "@/lib/unknown";
import { sameOriginWrite } from "@/lib/security/request";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, { feature: "facebook.publish", minRole: "editor" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "editor");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const { action, postId, commentId, message, profile, language } = (await req.json()) as {
      action: "fetch" | "draft" | "send";
      postId?: string;
      commentId?: string;
      message?: string;
      profile?: BusinessProfile;
      language?: Language;
    };

    if (action === "fetch") {
      if (!postId) return NextResponse.json({ error: "Post ID zaroori hai." }, { status: 400 });
      const comments = await fetchPostComments(access.settings, postId);
      return NextResponse.json({ comments });
    }
    if (action === "draft") {
      if (!message || !profile)
        return NextResponse.json({ error: "Comment text aur profile zaroori hain." }, { status: 400 });
      const reply = await generateCommentReply(message, profile, language || "ur");
      return NextResponse.json({ reply, limitation: "GENERATION_ONLY until you choose send." });
    }
    if (action === "send") {
      if (!commentId || !message)
        return NextResponse.json({ error: "Comment ID aur reply text zaroori hain." }, { status: 400 });
      await replyToComment(access.settings, commentId, message);
      await entitled.consume();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, "Kuch ghalat ho gaya.") }, { status: 500 });
  }
}
