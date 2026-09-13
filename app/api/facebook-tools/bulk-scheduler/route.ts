import { NextRequest, NextResponse } from "next/server";
import { generateContent } from "@/lib/claude";
import type { BusinessProfile, Language } from "@/lib/claude";
import { errorMessage } from "@/lib/unknown";
import { sameOriginWrite } from "@/lib/security/request";
import { addDraftRemote } from "@/lib/store-repository";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, {
    feature: "facebook.publish",
    minRole: "editor",
    usageMetric: "ai.generations",
  });
  if (!isProductAccess(entitled)) return entitled;
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
        const draft = await addDraftRemote(
          { req, workspaceId: entitled.tenant?.workspaceId },
          {
            channel: "facebook",
            kind: "new_content",
            title: content.title,
            body: content.body,
            metaDescription: content.hashtags?.join(", "),
          }
        );
        results.push({ topic, status: "queued", draftId: draft.id });
      } catch (err: unknown) {
        results.push({ topic, status: "failed", error: errorMessage(err) });
      }
    }
    await entitled.consume();
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Bulk scheduling fail ho gayi." }, { status: 500 });
  }
}
