import { NextRequest } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";
import { isSupabaseConfigured, supabaseRest } from "@/lib/db/supabase-rest";
import * as local from "@/lib/store";

export type StoreContext = { req?: NextRequest; workspaceId?: string };

function useRemote(ctx?: StoreContext) {
  return Boolean(ctx?.req && ctx.workspaceId && isSupabaseConfigured());
}

function q(params: Record<string, string>) {
  return `?${new URLSearchParams(params).toString()}`;
}

export async function listDraftsRemote(ctx: StoreContext) {
  if (!useRemote(ctx)) return local.listDrafts();
  return supabaseRest<local.ContentDraft[]>(ctx.req!, "drafts", {}, q({ workspace_id: `eq.${ctx.workspaceId}`, order: "created_at.desc" }));
}

export async function addDraftRemote(ctx: StoreContext, draft: Omit<local.ContentDraft, "id" | "status" | "createdAt">) {
  if (!useRemote(ctx)) return local.addDraft(draft);
  const row = { workspace_id: ctx.workspaceId, channel: draft.channel, kind: draft.kind, title: draft.title, body: draft.body, meta_description: draft.metaDescription ?? null, video_id: draft.videoId ?? null, target_url: draft.targetUrl ?? null, suggested_headings: draft.suggestedHeadings ?? null, schema_jsonld: draft.schemaJsonLd ?? null, status: "pending" };
  const [created] = await supabaseRest<any[]>(ctx.req!, "drafts", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
  return mapDraft(created);
}

export async function updateDraftRemote(ctx: StoreContext, id: string, patch: Partial<local.ContentDraft>) {
  if (!useRemote(ctx)) return local.updateDraft(id, patch);
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const map: Record<string, string> = { metaDescription: "meta_description", videoId: "video_id", targetUrl: "target_url", suggestedHeadings: "suggested_headings", schemaJsonLd: "schema_jsonld", createdAt: "created_at", publishedUrl: "published_url", errorMessage: "error_message" };
    row[map[key] || key] = value;
  }
  const rows = await supabaseRest<any[]>(ctx.req!, "drafts", { method: "PATCH", body: JSON.stringify(row), headers: { Prefer: "return=representation" } }, q({ id: `eq.${id}`, workspace_id: `eq.${ctx.workspaceId}` }));
  return rows[0] ? mapDraft(rows[0]) : null;
}

export async function getPublishSettingsRemote(ctx: StoreContext): Promise<local.PublishSettings> {
  if (!useRemote(ctx)) return local.getPublishSettings();
  const rows = await supabaseRest<any[]>(ctx.req!, "connections", {}, q({ workspace_id: `eq.${ctx.workspaceId}`, status: "neq.revoked" }));
  const result: local.PublishSettings = {};
  for (const row of rows) {
    try {
      const data = JSON.parse(decryptSecret(row.encrypted_credentials));
      if (row.provider === "wordpress") result.website = { platformType: "wordpress", wordpress: data, permission: data.permission ?? "suggest" };
      if (row.provider === "shopify") result.website = { platformType: "shopify", shopify: data, permission: data.permission ?? "suggest" };
      if (row.provider === "custom") result.website = { platformType: "custom", custom: data, permission: data.permission ?? "suggest" };
      if (row.provider === "youtube") result.youtube = { settings: data, permission: data.permission ?? "suggest" };
      if (row.provider === "facebook") result.facebook = { settings: data, permission: data.permission ?? "suggest" };
    } catch { /* never expose corrupt credentials */ }
  }
  return result;
}

export async function savePublishSettingsRemote(ctx: StoreContext, partial: Partial<local.PublishSettings>) {
  if (!useRemote(ctx)) return local.savePublishSettings(partial);
  const entries: Array<[string, any]> = [];
  if (partial.website) {
    const w = partial.website;
    if (w.wordpress) entries.push(["wordpress", { ...w.wordpress, permission: w.permission }]);
    if (w.shopify) entries.push(["shopify", { ...w.shopify, permission: w.permission }]);
    if (w.custom) entries.push(["custom", { ...w.custom, permission: w.permission }]);
  }
  if (partial.youtube) entries.push(["youtube", { ...partial.youtube.settings, permission: partial.youtube.permission }]);
  if (partial.facebook) entries.push(["facebook", { ...partial.facebook.settings, permission: partial.facebook.permission }]);
  for (const [provider, data] of entries) {
    const encrypted_credentials = encryptSecret(JSON.stringify(data));
    await supabaseRest(ctx.req!, "connections", { method: "POST", body: JSON.stringify({ workspace_id: ctx.workspaceId, provider, encrypted_credentials, status: "active", updated_at: new Date().toISOString() }), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }, "?on_conflict=workspace_id,provider");
  }
}

export async function recordSeoScoreRemote(ctx: StoreContext, url: string, score: number, deterministicScore?: number, aiScore?: number) {
  if (!useRemote(ctx)) return local.recordSeoScore(url, score);
  await supabaseRest(ctx.req!, "seo_score_history", { method: "POST", body: JSON.stringify({ workspace_id: ctx.workspaceId, url, score, deterministic_score: deterministicScore ?? null, ai_score: aiScore ?? null }) });
}

export async function getSeoScoreHistoryRemote(ctx: StoreContext, url?: string) {
  if (!useRemote(ctx)) return local.getSeoScoreHistory(url);
  const params: Record<string,string> = { workspace_id: `eq.${ctx.workspaceId}`, order: "created_at.asc" };
  if (url) params.url = `eq.${url}`;
  const rows = await supabaseRest<any[]>(ctx.req!, "seo_score_history", {}, q(params));
  return rows.map((r) => ({ url: r.url, score: r.score, date: r.created_at }));
}

export async function listCalendarItemsRemote(ctx: StoreContext) {
  if (!useRemote(ctx)) return local.listCalendarItems();
  const rows = await supabaseRest<any[]>(ctx.req!, "calendar_items", {}, q({ workspace_id: `eq.${ctx.workspaceId}`, order: "scheduled_date.asc" }));
  return rows.map(mapCalendar);
}

export async function addCalendarItemRemote(ctx: StoreContext, item: Omit<local.CalendarItem, "id" | "status" | "createdAt">) {
  if (!useRemote(ctx)) return local.addCalendarItem(item);
  const [row] = await supabaseRest<any[]>(ctx.req!, "calendar_items", { method: "POST", body: JSON.stringify({ workspace_id: ctx.workspaceId, channel: item.channel, topic: item.topic, scheduled_date: item.scheduledDate, status: "planned" }), headers: { Prefer: "return=representation" } });
  return mapCalendar(row);
}

export async function updateCalendarItemRemote(ctx: StoreContext, id: string, patch: Partial<local.CalendarItem>) {
  if (!useRemote(ctx)) return local.updateCalendarItem(id, patch);
  const row: Record<string,unknown> = {};
  if (patch.channel) row.channel = patch.channel;
  if (patch.topic) row.topic = patch.topic;
  if (patch.scheduledDate) row.scheduled_date = patch.scheduledDate;
  if (patch.status) row.status = patch.status;
  if (patch.resultDraftId) row.result_draft_id = patch.resultDraftId;
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;
  const rows = await supabaseRest<any[]>(ctx.req!, "calendar_items", { method: "PATCH", body: JSON.stringify(row), headers: { Prefer: "return=representation" } }, q({ id: `eq.${id}`, workspace_id: `eq.${ctx.workspaceId}` }));
  return rows[0] ? mapCalendar(rows[0]) : null;
}

export async function getDueCalendarItemsRemote(ctx: StoreContext) {
  if (!useRemote(ctx)) return local.getDueCalendarItems();
  const today = new Date().toISOString().slice(0,10);
  const rows = await supabaseRest<any[]>(ctx.req!, "calendar_items", {}, q({ workspace_id: `eq.${ctx.workspaceId}`, status: "eq.planned", scheduled_date: `lte.${today}`, order: "scheduled_date.asc" }));
  return rows.map(mapCalendar);
}

function mapDraft(r: any): local.ContentDraft { return { id:r.id, channel:r.channel, kind:r.kind, title:r.title, body:r.body, metaDescription:r.meta_description ?? undefined, videoId:r.video_id ?? undefined, targetUrl:r.target_url ?? undefined, suggestedHeadings:r.suggested_headings ?? undefined, schemaJsonLd:r.schema_jsonld ?? undefined, status:r.status, createdAt:r.created_at, publishedUrl:r.published_url ?? undefined, errorMessage:r.error_message ?? undefined }; }
function mapCalendar(r:any): local.CalendarItem { return { id:r.id, channel:r.channel, topic:r.topic, scheduledDate:r.scheduled_date, status:r.status, createdAt:r.created_at, resultDraftId:r.result_draft_id ?? undefined, errorMessage:r.error_message ?? undefined }; }

export async function createDraftVersionRemote(ctx: StoreContext, input: {
  draftId: string; original: Record<string, unknown>; optimized: Record<string, unknown>;
  decisions: unknown[]; warnings?: string[]; source?: string; createdBy?: string; rollbackOfVersionId?: string;
}) {
  if (!useRemote(ctx)) throw new Error("Optimization versioning requires a Supabase workspace in production mode.");
  const existing = await supabaseRest<any[]>(ctx.req!, "draft_versions", {}, q({ workspace_id: `eq.${ctx.workspaceId}`, draft_id: `eq.${input.draftId}`, order: "version_number.desc", limit: "1" }));
  const versionNumber = (existing[0]?.version_number ?? 0) + 1;
  const [row] = await supabaseRest<any[]>(ctx.req!, "draft_versions", { method: "POST", body: JSON.stringify({ workspace_id: ctx.workspaceId, draft_id: input.draftId, version_number: versionNumber, source: input.source ?? "ai_optimization", status: "proposed", original_content: input.original, optimized_content: input.optimized, change_decisions: input.decisions, warnings: input.warnings ?? [], created_by: input.createdBy ?? null, rollback_of_version_id: input.rollbackOfVersionId ?? null }), headers: { Prefer: "return=representation" } });
  return mapDraftVersion(row);
}

export async function listDraftVersionsRemote(ctx: StoreContext, draftId: string) {
  if (!useRemote(ctx)) throw new Error("Optimization versioning requires a Supabase workspace in production mode.");
  const rows = await supabaseRest<any[]>(ctx.req!, "draft_versions", {}, q({ workspace_id: `eq.${ctx.workspaceId}`, draft_id: `eq.${draftId}`, order: "version_number.desc" }));
  return rows.map(mapDraftVersion);
}

export async function getDraftVersionRemote(ctx: StoreContext, id: string) {
  if (!useRemote(ctx)) throw new Error("Optimization versioning requires a Supabase workspace in production mode.");
  const rows = await supabaseRest<any[]>(ctx.req!, "draft_versions", {}, q({ workspace_id: `eq.${ctx.workspaceId}`, id: `eq.${id}`, limit: "1" }));
  return rows[0] ? mapDraftVersion(rows[0]) : null;
}

export async function updateDraftVersionRemote(ctx: StoreContext, id: string, patch: Record<string, unknown>) {
  if (!useRemote(ctx)) throw new Error("Optimization versioning requires a Supabase workspace in production mode.");
  const rows = await supabaseRest<any[]>(ctx.req!, "draft_versions", { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } }, q({ workspace_id: `eq.${ctx.workspaceId}`, id: `eq.${id}` }));
  return rows[0] ? mapDraftVersion(rows[0]) : null;
}

function mapDraftVersion(r: any) {
  return { id: r.id, draftId: r.draft_id, workspaceId: r.workspace_id, versionNumber: r.version_number, source: r.source, status: r.status, original: r.original_content, optimized: r.optimized_content, decisions: r.change_decisions ?? [], warnings: r.warnings ?? [], createdBy: r.created_by ?? undefined, createdAt: r.created_at, rollbackOfVersionId: r.rollback_of_version_id ?? undefined, approvedAt: r.approved_at ?? undefined, appliedAt: r.applied_at ?? undefined };
}
