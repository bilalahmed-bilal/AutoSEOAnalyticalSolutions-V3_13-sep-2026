import { supabaseAdmin } from "@/lib/db/supabase-rest";
import type { ContentDraft, PublishSettings, WordPressSettings, ShopifySettings, CustomSiteSettings, YouTubeSettings, FacebookSettings } from "@/lib/store";
import { publishDraftWithSettings } from "@/lib/publish-dispatch";
import { claimNextJob, completeJob, failJob, newWorkerId } from "@/lib/jobs/queue";
import { finishJobAttempt, startJobAttempt } from "@/lib/jobs/attempts";
import { refreshConnectionIfNeeded, markConnectionHealth } from "@/lib/oauth/lifecycle";
import { recordPublication } from "@/lib/rollback/history";

export async function processOnePublishJob(workerId = newWorkerId("publish")) {
  const job = await claimNextJob(workerId);
  if (!job) return { claimed: false as const };

  const draftId = String(job.payload.draftId || "");
  try {
    await startJobAttempt(job.id, job.workspaceId, job.attempts, workerId).catch((e) => console.error("job attempt start failed", e));
    if (job.type !== "publish_draft") throw new Error(`Unsupported job type: ${job.type}`);
    if (!draftId) throw new Error("publish_draft job missing draftId.");

    const drafts = await supabaseAdmin<any[]>("drafts", {}, `?id=eq.${encodeURIComponent(draftId)}&workspace_id=eq.${encodeURIComponent(job.workspaceId)}&limit=1`);
    const row = drafts[0];
    if (!row) throw new Error("Draft not found.");

    // Normal jobs never republish a completed draft. Experiment jobs intentionally do so
    // because sequential SEO experiments switch the same URL between approved variants.
    const experimentId = typeof job.payload.experimentId === "string" ? job.payload.experimentId : undefined;
    if (!experimentId && row.status === "published") {
      await completeJob(job.id, workerId, {});
      await finishJobAttempt({ jobId: job.id, attempt: job.attempts, status: "succeeded", providerLink: row.published_url ?? undefined }).catch((e) => console.error("job attempt finish failed", e));
      return { claimed: true as const, success: true as const, jobId: job.id, draftId, alreadyPublished: true as const, publishedUrl: row.published_url ?? undefined };
    }

    const connections = await supabaseAdmin<any[]>("connections", {}, `?workspace_id=eq.${encodeURIComponent(job.workspaceId)}&status=neq.revoked`);
    const settings: PublishSettings = {};
    for (const c of connections) {
      const data = await refreshConnectionIfNeeded(c);
      if (c.provider === "wordpress") {
        if (typeof data.siteUrl !== "string" || typeof data.username !== "string" || typeof data.applicationPassword !== "string") throw new Error("WordPress connection credentials incomplete hain.");
        const wordpress: WordPressSettings = { siteUrl: data.siteUrl, username: data.username, applicationPassword: data.applicationPassword };
        settings.website = { platformType: "wordpress", wordpress, permission: data.permission ?? "suggest" };
      }
      if (c.provider === "shopify") {
        if (typeof data.shopDomain !== "string" || typeof data.accessToken !== "string") throw new Error("Shopify connection credentials incomplete hain.");
        const shopify: ShopifySettings = { shopDomain: data.shopDomain, accessToken: data.accessToken };
        settings.website = { platformType: "shopify", shopify, permission: data.permission ?? "suggest" };
      }
      if (c.provider === "custom") {
        if (typeof data.webhookUrl !== "string" || typeof data.apiKey !== "string") throw new Error("Custom site connection credentials incomplete hain.");
        const custom: CustomSiteSettings = { webhookUrl: data.webhookUrl, apiKey: data.apiKey };
        settings.website = { platformType: "custom", custom, permission: data.permission ?? "suggest" };
      }
      if (c.provider === "youtube") {
        if (typeof data.accessToken !== "string") throw new Error("YouTube connection access token missing hai.");
        const youtube: YouTubeSettings = { accessToken: data.accessToken };
        settings.youtube = { settings: youtube, permission: data.permission ?? "suggest" };
      }
      if (c.provider === "facebook") {
        if (typeof data.pageId !== "string" || typeof data.pageAccessToken !== "string") throw new Error("Facebook Page credentials incomplete hain.");
        const facebook: FacebookSettings = { pageId: data.pageId, pageAccessToken: data.pageAccessToken };
        settings.facebook = { settings: facebook, permission: data.permission ?? "suggest" };
      }
    }

    const draft: ContentDraft = {
      id: row.id, channel: row.channel, kind: row.kind, title: row.title, body: row.body,
      metaDescription: row.meta_description ?? undefined, videoId: row.video_id ?? undefined,
      targetUrl: row.target_url ?? undefined, suggestedHeadings: row.suggested_headings ?? undefined,
      schemaJsonLd: row.schema_jsonld ?? undefined, status: row.status, createdAt: row.created_at,
      publishedUrl: row.published_url ?? undefined, errorMessage: row.error_message ?? undefined,
    };

    const link = await publishDraftWithSettings(draft, settings);
    if (!link) throw new Error("Publisher ne verification link return nahi kiya.");

    await supabaseAdmin("drafts", { method: "PATCH", body: JSON.stringify({ status: "published", published_url: link, error_message: null }), headers: { Prefer: "return=minimal" } }, `?id=eq.${encodeURIComponent(draft.id)}&workspace_id=eq.${encodeURIComponent(job.workspaceId)}`);
    const sourceVersionId = typeof job.payload.sourceVersionId === "string" ? job.payload.sourceVersionId : undefined;
    const rollbackOfVersionId = typeof job.payload.rollbackOfVersionId === "string" ? job.payload.rollbackOfVersionId : undefined;
    const eventType = rollbackOfVersionId ? "rollback_published" : "published";
    await recordPublication({ workspaceId: job.workspaceId, draftId, versionId: sourceVersionId, eventType, snapshot: { title: draft.title, metaDescription: draft.metaDescription ?? "", h1: draft.title, body: draft.body, targetUrl: draft.targetUrl, channel: draft.channel, kind: draft.kind }, publishedUrl: link, jobId: job.id }).catch((e) => console.error("publication history write failed", e));
    await completeJob(job.id, workerId, {});
    await finishJobAttempt({ jobId: job.id, attempt: job.attempts, status: "succeeded", providerLink: link }).catch((e) => console.error("job attempt finish failed", e));
    return { claimed: true as const, success: true as const, jobId: job.id, draftId, publishedUrl: link };
  } catch (error: any) {
    const message = String(error?.message || "Publish job failed.");
    await failJob(job.id, workerId, job.attempts, message, job.maxAttempts);
    await supabaseAdmin("drafts", { method: "PATCH", body: JSON.stringify({ status: job.attempts >= job.maxAttempts ? "failed" : "approved", error_message: message.slice(0, 2000) }), headers: { Prefer: "return=minimal" } }, `?id=eq.${encodeURIComponent(draftId)}&workspace_id=eq.${encodeURIComponent(job.workspaceId)}`);
    if (typeof job.payload.rollbackOfVersionId === "string" && job.attempts >= job.maxAttempts) {
      await recordPublication({ workspaceId: job.workspaceId, draftId, versionId: typeof job.payload.sourceVersionId === "string" ? job.payload.sourceVersionId : undefined, eventType: "rollback_failed", snapshot: { title: "", metaDescription: "", h1: "", body: "" }, jobId: job.id }).catch((e) => console.error("rollback failure history write failed", e));
    }
    await finishJobAttempt({ jobId: job.id, attempt: job.attempts, status: "failed", errorMessage: message }).catch((e) => console.error("job attempt finish failed", e));
    return { claimed: true as const, success: false as const, jobId: job.id, draftId, error: message };
  }
}


export async function processPublishBatch(limit = 5) {
  const results = [];
  for (let i = 0; i < Math.max(1, Math.min(limit, 20)); i++) {
    const result = await processOnePublishJob();
    results.push(result);
    if (!result.claimed) break;
  }
  return results;
}
