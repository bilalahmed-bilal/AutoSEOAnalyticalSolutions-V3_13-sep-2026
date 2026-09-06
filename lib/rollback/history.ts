import { supabaseAdmin } from "@/lib/db/supabase-rest";
import type { OptimizedSnapshot } from "@/lib/optimization/versioning";

export interface PublicationSnapshot extends OptimizedSnapshot {
  targetUrl?: string;
  channel?: string;
  kind?: string;
}

export async function recordPublication(input: {
  workspaceId: string; draftId: string; versionId?: string; eventType: "published" | "rollback_requested" | "rollback_published" | "rollback_failed";
  snapshot: PublicationSnapshot; publishedUrl?: string; jobId?: string; createdBy?: string;
}) {
  const [row] = await supabaseAdmin<any[]>("draft_publication_history", {
    method: "POST", body: JSON.stringify({
      workspace_id: input.workspaceId, draft_id: input.draftId, version_id: input.versionId ?? null,
      event_type: input.eventType, snapshot: input.snapshot, published_url: input.publishedUrl ?? null,
      job_id: input.jobId ?? null, created_by: input.createdBy ?? null,
    }), headers: { Prefer: "return=representation" },
  });
  return row ?? null;
}

export async function listPublicationHistory(workspaceId: string, draftId: string) {
  return supabaseAdmin<any[]>("draft_publication_history", {}, `?workspace_id=eq.${encodeURIComponent(workspaceId)}&draft_id=eq.${encodeURIComponent(draftId)}&order=created_at.desc`);
}
