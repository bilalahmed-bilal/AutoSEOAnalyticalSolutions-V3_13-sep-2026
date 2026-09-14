import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { type Channel } from "@/lib/store";
import { addDraftRemote, listDraftsRemote, getPublishSettingsRemote, updateDraftRemote } from "@/lib/store-repository";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { publishFeatureForChannel } from "@/lib/billing/route-policy";
import { enqueueJob, publishJobKey } from "@/lib/jobs/queue";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  return NextResponse.json({ drafts: await listDraftsRemote({ req, workspaceId: tenant?.workspaceId }) });
}

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const rate = checkRateLimit(req, "publish");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many publish requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "editor");
    if (!isRoleResult(permission)) return permission;
  }
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  try {
    const { channel, kind, title, body, metaDescription, videoId, targetUrl, suggestedHeadings, schemaJsonLd } =
      (await req.json()) as {
        channel: Channel;
        kind?: "new_content" | "seo_fix";
        title: string;
        body: string;
        metaDescription?: string;
        videoId?: string;
        targetUrl?: string;
        suggestedHeadings?: string[];
        schemaJsonLd?: string;
      };

    if (!channel || !title || !body) {
      return NextResponse.json({ error: "Channel, title, and body are required." }, { status: 400 });
    }
    const publishFeature = publishFeatureForChannel(channel);
    if (publishFeature && access.authenticated) {
      const entitled = await requireProductAccess(req, {
        feature: publishFeature,
        minRole: "editor",
        usageMetric:
          channel === "youtube" ? "youtube.publish" : channel === "facebook" ? "facebook.publish" : undefined,
      });
      if (!isProductAccess(entitled)) return entitled;
    }
    if (channel === "youtube" && !videoId) {
      return NextResponse.json({ error: "An existing YouTube video ID is required." }, { status: 400 });
    }
    const draftKind = kind || "new_content";
    if (draftKind === "seo_fix" && !targetUrl) {
      return NextResponse.json({ error: "A target URL is required for SEO fixes." }, { status: 400 });
    }

    const draft = await addDraftRemote(
      { req, workspaceId: tenant?.workspaceId },
      {
        channel,
        kind: draftKind,
        title,
        body,
        metaDescription,
        videoId,
        targetUrl,
        suggestedHeadings,
        schemaJsonLd,
      }
    );

    // "auto" means durable automatic publishing: approve + enqueue.
    // The scheduler/worker performs the actual provider call outside the request.
    const settings = await getPublishSettingsRemote({ req, workspaceId: tenant?.workspaceId });
    const permission =
      channel === "website"
        ? settings.website?.permission
        : channel === "youtube"
          ? settings.youtube?.permission
          : settings.facebook?.permission;

    if (permission === "auto") {
      const approved = await updateDraftRemote({ req, workspaceId: tenant?.workspaceId }, draft.id, {
        status: "approved",
        errorMessage: undefined,
      });
      if (!approved) return NextResponse.json({ error: "The draft could not be approved." }, { status: 500 });

      if (tenant?.workspaceId) {
        const job = await enqueueJob({
          workspaceId: tenant.workspaceId,
          type: "publish_draft",
          payload: { draftId: draft.id },
          idempotencyKey: publishJobKey(tenant.workspaceId, draft.id),
        });
        return NextResponse.json({ draft: approved, queued: true, jobId: job?.id });
      }

      // Local/demo mode has no durable worker; retain the draft as approved.
      return NextResponse.json({
        draft: approved,
        queued: false,
        message: "Demo mode: configure Supabase and a worker for durable publishing.",
      });
    }

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("queue add error:", err);
    return NextResponse.json({ error: "The draft could not be added to the queue." }, { status: 500 });
  }
}
