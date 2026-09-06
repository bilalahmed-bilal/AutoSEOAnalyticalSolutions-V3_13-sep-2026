import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { getDueCalendarItemsRemote, updateCalendarItemRemote, addDraftRemote, updateDraftRemote, getPublishSettingsRemote } from "@/lib/store-repository";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { generateContent, type BusinessProfile, type Language } from "@/lib/claude";
import { publishDraftToChannel } from "@/lib/publish-dispatch";

// This route stands in for a real cron/scheduler in production — Next.js's
// dev server has no persistent background worker, so "automation" here means
// "process everything that's due, on demand" via this button. A production
// deployment would call this same route from a real cron job (e.g. Vercel
// Cron) instead of a manual click — the logic itself doesn't need to change.

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "editor");
    if (!isRoleResult(permission)) return permission;
  }
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  try {
    const { profile, language } = (await req.json()) as {
      profile: BusinessProfile;
      language: Language;
    };

    if (!profile?.businessName) {
      return NextResponse.json(
        { error: "Business profile chahiye content generate karne ke liye." },
        { status: 400 }
      );
    }

    const due = await getDueCalendarItemsRemote({ req, workspaceId: tenant?.workspaceId });
    const results = [];

    for (const item of due) {
      try {
        const content = await generateContent({
          channel: item.channel,
          language,
          topic: item.topic,
          profile,
        });

        if (item.channel === "youtube") {
          // Calendar automation can't know a video ID in advance — skip
          // auto-publish for YouTube items, leave as "generated" for manual
          // follow-up with a video ID from the Content Generator tab.
          await updateCalendarItemRemote({ req, workspaceId: tenant?.workspaceId }, item.id, { status: "generated" });
          results.push({ item: item.id, status: "generated", note: "YouTube: Video ID manually add karein." });
          continue;
        }

        const draft = await addDraftRemote({ req, workspaceId: tenant?.workspaceId }, {
          channel: item.channel,
          kind: "new_content",
          title: content.title,
          body: content.body,
          metaDescription:
            content.metaDescription || (content.hashtags ? content.hashtags.join(", ") : undefined),
        });

        const settings = await getPublishSettingsRemote({ req, workspaceId: tenant?.workspaceId });
        const permission =
          item.channel === "website" ? settings.website?.permission : settings.facebook?.permission;

        if (permission === "auto") {
          await updateDraftRemote({ req, workspaceId: tenant?.workspaceId }, draft.id, { status: "approved" });
          try {
            const link = await publishDraftToChannel({ ...draft, status: "approved" }, { req, workspaceId: tenant?.workspaceId });
            await updateDraftRemote({ req, workspaceId: tenant?.workspaceId }, draft.id, { status: "published", publishedUrl: link });
          } catch (pubErr: any) {
            await updateDraftRemote({ req, workspaceId: tenant?.workspaceId }, draft.id, { status: "failed", errorMessage: pubErr.message });
          }
        }

        await updateCalendarItemRemote({ req, workspaceId: tenant?.workspaceId }, item.id, { status: "generated", resultDraftId: draft.id });
        results.push({ item: item.id, status: "generated", draftId: draft.id });
      } catch (genErr: any) {
        await updateCalendarItemRemote({ req, workspaceId: tenant?.workspaceId }, item.id, {
          status: "failed",
          errorMessage: genErr.message || "Generation fail ho gaya.",
        });
        results.push({ item: item.id, status: "failed", error: genErr.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    console.error("calendar run error:", err);
    return NextResponse.json({ error: "Calendar run nahi ho saka." }, { status: 500 });
  }
}
