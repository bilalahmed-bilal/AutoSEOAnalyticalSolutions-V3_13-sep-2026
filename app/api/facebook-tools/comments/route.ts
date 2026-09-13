import { NextRequest, NextResponse } from "next/server";
import { getPublishSettings } from "@/lib/store";
import { fetchPostComments, replyToComment } from "@/lib/publishers/facebook";
import { generateCommentReply } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";
import { errorMessage } from "@/lib/unknown";

export async function POST(req: NextRequest) {
  try {
    const { action, postId, commentId, message, profile, language } = (await req.json()) as {
      action: "fetch" | "draft" | "send";
      postId?: string;
      commentId?: string;
      message?: string;
      profile?: BusinessProfile;
      language?: Language;
    };

    const settings = getPublishSettings();
    if (!settings.facebook) {
      return NextResponse.json({ error: "Pehle Publish tab mein Facebook connect karein." }, { status: 400 });
    }

    if (action === "fetch") {
      if (!postId) return NextResponse.json({ error: "Post ID zaroori hai." }, { status: 400 });
      const comments = await fetchPostComments(settings.facebook.settings, postId);
      return NextResponse.json({ comments });
    }

    if (action === "draft") {
      if (!message || !profile)
        return NextResponse.json({ error: "Comment text aur profile zaroori hain." }, { status: 400 });
      const reply = await generateCommentReply(message, profile, language || "ur");
      return NextResponse.json({ reply });
    }

    if (action === "send") {
      if (!commentId || !message)
        return NextResponse.json({ error: "Comment ID aur reply text zaroori hain." }, { status: 400 });
      await replyToComment(settings.facebook.settings, commentId, message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: unknown) {
    console.error("fb comments error:", err);
    return NextResponse.json({ error: errorMessage(err, "Kuch ghalat ho gaya.") }, { status: 500 });
  }
}
