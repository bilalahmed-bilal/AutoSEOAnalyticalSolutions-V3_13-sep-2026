import { NextRequest, NextResponse } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { addDraftRemote } from "@/lib/store-repository";
import { sameOriginWrite } from "@/lib/security/request";
import { fetchVideoSnippet } from "@/lib/publishers/youtube";
import { generateYouTubeSeoFix } from "@/lib/claude";
import type { Language } from "@/lib/claude";
import { createApproval } from "@/lib/approval/repository";
import { evaluateYouTubeRisk } from "@/lib/approval/risk";
import { errorMessage } from "@/lib/unknown";

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireYouTubeAccess(req, "editor", "youtube.bulk");
  if (!isYouTubeSecurityContext(access)) return access;
  try {
    const { videoIds, niche, language } = (await req.json()) as {
      videoIds?: string[];
      niche?: string;
      language?: Language;
    };
    if (!videoIds || videoIds.length === 0 || !niche) {
      return NextResponse.json({ error: "Video IDs and a niche are required." }, { status: 400 });
    }
    if (videoIds.length > 10) {
      return NextResponse.json({ error: "A maximum of 10 videos is allowed at once." }, { status: 400 });
    }

    const results = [];
    for (const videoId of videoIds) {
      try {
        const existing = await fetchVideoSnippet(access.settings, videoId);
        const fix = await generateYouTubeSeoFix(existing, niche, language || "en");
        // Bulk changes are always "suggest only" (queued for manual approval),
        // regardless of the channel's auto-publish permission setting — per
        // Section 3's risk tiers, bulk edits are a high-risk category.
        const risk = evaluateYouTubeRisk("bulk_metadata_update", access.settings.permission || "suggest");
        const draft = await addDraftRemote(
          { req, workspaceId: access.workspaceId },
          {
            channel: "youtube",
            kind: "new_content",
            title: fix.title,
            body: fix.description,
            metaDescription: fix.tags.join(", "),
            videoId,
          }
        );
        const approval = await createApproval(
          { req, workspaceId: access.workspaceId },
          {
            actionType: "bulk_metadata_update",
            risk: risk.risk,
            status: "pending",
            targetId: videoId,
            payload: { draftId: draft.id, videoId, title: fix.title, description: fix.description, tags: fix.tags },
            reason: risk.reason,
            requestedBy: access.userId,
          }
        );
        results.push({ videoId, status: "pending_approval", draftId: draft.id, approvalId: approval.id });
      } catch (err: unknown) {
        results.push({ videoId, status: "failed", error: errorMessage(err) });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("bulk optimize error:", err);
    return NextResponse.json({ error: "Bulk optimize failed." }, { status: 500 });
  }
}
