import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { createIdempotencyKey, nextRetryAt } from "@/lib/jobs/idempotency";
import type { JobRecord, JobStatus } from "@/lib/jobs/types";
import { type UnknownRecord } from "@/lib/unknown";

export type PublishJobPayload = { draftId: string };

export async function enqueueJob(input: {
  workspaceId: string;
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  maxAttempts?: number;
  runAfter?: Date;
}) {
  const row = {
    workspace_id: input.workspaceId,
    type: input.type,
    payload: input.payload,
    idempotency_key: input.idempotencyKey,
    max_attempts: input.maxAttempts ?? 5,
    run_after: (input.runAfter ?? new Date()).toISOString(),
    status: "queued",
  };
  const rows = await supabaseAdmin<UnknownRecord[]>("jobs", {
    method: "POST",
    body: JSON.stringify(row),
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
  });
  return rows[0] ? mapJob(rows[0]) : findJobByKey(input.workspaceId, input.idempotencyKey);
}

export async function findJobByKey(workspaceId: string, idempotencyKey: string) {
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "jobs",
    {},
    `?workspace_id=eq.${workspaceId}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function claimNextJob(workerId: string): Promise<JobRecord | null> {
  const result = await supabaseAdmin<UnknownRecord>("rpc/claim_next_job", {
    method: "POST",
    body: JSON.stringify({ p_worker_id: workerId }),
  });
  if (!result) return null;
  return mapJob(Array.isArray(result) ? result[0] : result);
}

export async function completeJob(id: string, workerId: string, result?: { providerJobId?: string }) {
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "jobs",
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "succeeded",
        locked_at: null,
        locked_by: null,
        provider_job_id: result?.providerJobId ?? null,
        last_error: null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=representation" },
    },
    `?id=eq.${id}&status=eq.running&locked_by=eq.${encodeURIComponent(workerId)}`
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function failJob(id: string, workerId: string, attempt: number, error: string, maxAttempts: number) {
  const terminal = attempt >= maxAttempts;
  const row = terminal
    ? {
        status: "failed",
        locked_at: null,
        locked_by: null,
        last_error: error.slice(0, 2000),
        updated_at: new Date().toISOString(),
      }
    : {
        status: "queued",
        locked_at: null,
        locked_by: null,
        run_after: nextRetryAt(attempt).toISOString(),
        last_error: error.slice(0, 2000),
        updated_at: new Date().toISOString(),
      };
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "jobs",
    { method: "PATCH", body: JSON.stringify(row), headers: { Prefer: "return=representation" } },
    `?id=eq.${id}&status=eq.running&locked_by=eq.${encodeURIComponent(workerId)}`
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export function publishJobKey(workspaceId: string, draftId: string) {
  return createIdempotencyKey(["publish_draft", workspaceId, draftId]);
}

export function publishVersionJobKey(workspaceId: string, draftId: string, versionId: string) {
  return createIdempotencyKey(["publish_draft", workspaceId, draftId, "version", versionId]);
}

function mapJob(r: UnknownRecord): JobRecord {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    idempotencyKey: r.idempotency_key,
    type: r.type,
    payload: r.payload ?? {},
    status: r.status as JobStatus,
    attempts: r.attempts ?? 0,
    maxAttempts: r.max_attempts ?? 5,
    runAfter: r.run_after,
    lockedAt: r.locked_at ?? undefined,
    lockedBy: r.locked_by ?? undefined,
    providerJobId: r.provider_job_id ?? undefined,
    lastError: r.last_error ?? undefined,
  };
}

export function newWorkerId(prefix = "autoseo") {
  return `${prefix}-${process.pid}-${crypto.randomUUID()}`;
}

export function experimentPublishJobKey(workspaceId: string, experimentId: string, variant: "a" | "b") {
  return createIdempotencyKey(["seo_experiment", workspaceId, experimentId, variant]);
}

export function experimentPromotionJobKey(workspaceId: string, experimentId: string, variant: "a" | "b") {
  return createIdempotencyKey(["seo_experiment_promotion", workspaceId, experimentId, variant]);
}
