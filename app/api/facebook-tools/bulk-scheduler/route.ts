import { NextRequest, NextResponse } from "next/server";
import { addDraft } from "@/lib/store";
import { generateContent } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";
import { errorMessage } from "@/lib/unknown";

export async function POST(req: NextRequest) {
  try {
    const { topics, profile, language } = (await req.json()) as {
      topics?: string[];
      profile?: BusinessProfile;
      language?: Language;
    };
    if (!topics || topics.length === 0 || !profile) {
      return NextResponse.json({ error: "Topics aur business profile zaroori hain." }, { status: 400 });
    }
    if (topics.length > 10) {
      return NextResponse.json({ error: "Ek baar mein zyada se zyada 10 topics." }, { status: 400 });
    }

    const results = [];
    for (const topic of topics) {
      try {
        const content = await generateContent({
          channel: "facebook",
          language: language || "ur",
          topic,
          profile,
        });
        // Bulk scheduling is a high-risk action category — always queued for
        // manual approval, same principle as YouTube's Bulk Optimizer.
        const draft = addDraft({
          channel: "facebook",
          kind: "new_content",
          title: content.title,
          body: content.body,
          metaDescription: content.hashtags?.join(", "),
        });
        results.push({ topic, status: "queued", draftId: draft.id });
      } catch (err: unknown) {
        results.push({ topic, status: "failed", error: errorMessage(err) });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("fb bulk scheduler error:", err);
    return NextResponse.json({ error: "Bulk scheduling fail ho gayi." }, { status: 500 });
  }
}
