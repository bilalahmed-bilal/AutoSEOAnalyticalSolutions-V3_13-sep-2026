import type { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { normalizeSteps, type WorkflowStep } from "@/lib/automation-workflows";
import { createIdempotencyKey } from "@/lib/jobs/idempotency";
import { getNextScheduledRun } from "@/lib/automation/scheduler";
import { type UnknownRecord } from "@/lib/unknown";

const q = (p: Record<string, string>) => "?" + new URLSearchParams(p).toString();
const mapW = (r: UnknownRecord) => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  description: r.description ?? "",
  status: r.status,
  triggerType: r.trigger_type,
  schedule: r.schedule ?? undefined,
  steps: normalizeSteps(r.steps),
  lastRunAt: r.last_run_at ?? undefined,
  nextRunAt: r.next_run_at ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapR = (r: UnknownRecord) => ({
  id: r.id,
  workflowId: r.workflow_id,
  workspaceId: r.workspace_id,
  status: r.status,
  input: r.input ?? {},
  results: r.results ?? [],
  error: r.error ?? undefined,
  attempts: r.attempts ?? 0,
  maxAttempts: r.max_attempts ?? 5,
  runAfter: r.run_after ?? undefined,
  lockedAt: r.locked_at ?? undefined,
  lockedBy: r.locked_by ?? undefined,
  startedAt: r.started_at ?? undefined,
  finishedAt: r.finished_at ?? undefined,
  createdAt: r.created_at,
});
export async function listWorkflows(ctx: { req: NextRequest; workspaceId: string }) {
  const rows = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "automation_workflows",
    {},
    q({ workspace_id: `eq.${ctx.workspaceId}`, order: "created_at.desc" })
  );
  return rows.map(mapW);
}
export async function getWorkflow(ctx: { req: NextRequest; workspaceId: string }, id: string) {
  const rows = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "automation_workflows",
    {},
    q({ workspace_id: `eq.${ctx.workspaceId}`, id: `eq.${id}`, limit: "1" })
  );
  return rows[0] ? mapW(rows[0]) : null;
}
export async function createWorkflow(
  ctx: { req: NextRequest; workspaceId: string },
  input: {
    name: string;
    description?: string;
    status?: string;
    triggerType: string;
    schedule?: string;
    steps: WorkflowStep[];
    createdBy?: string;
  }
) {
  const [row] = await supabaseRest<UnknownRecord[]>(ctx.req, "automation_workflows", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: ctx.workspaceId,
      name: input.name,
      description: input.description || null,
      status: input.status || "active",
      trigger_type: input.triggerType,
      schedule: input.schedule || null,
      steps: input.steps,
      created_by: input.createdBy || null,
      next_run_at:
        input.triggerType === "schedule" && input.schedule
          ? (getNextScheduledRun(input.schedule)?.toISOString() ?? null)
          : null,
    }),
    headers: { Prefer: "return=representation" },
  });
  return mapW(row);
}
export async function updateWorkflow(
  ctx: { req: NextRequest; workspaceId: string },
  id: string,
  input: Partial<{
    name: string;
    description: string;
    status: string;
    triggerType: string;
    schedule: string;
    steps: WorkflowStep[];
  }>
) {
  const body: UnknownRecord = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.status !== undefined) body.status = input.status;
  if (input.triggerType !== undefined) body.trigger_type = input.triggerType;
  if (input.schedule !== undefined) body.schedule = input.schedule;
  if (input.steps !== undefined) body.steps = input.steps;
  if (input.triggerType === "schedule" && input.schedule) {
    body.next_run_at = getNextScheduledRun(input.schedule)?.toISOString() ?? null;
  } else if (input.triggerType && input.triggerType !== "schedule") {
    body.next_run_at = null;
  }
  body.updated_at = new Date().toISOString();
  const [row] = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "automation_workflows",
    { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=representation" } },
    q({ workspace_id: `eq.${ctx.workspaceId}`, id: `eq.${id}` })
  );
  return row ? mapW(row) : null;
}
export async function createRun(
  ctx: { req: NextRequest; workspaceId: string },
  input: { workflowId: string; input?: Record<string, unknown>; createdBy?: string; idempotencyKey?: string }
) {
  const idempotencyKey =
    input.idempotencyKey ||
    createIdempotencyKey(["automation_run", ctx.workspaceId, input.workflowId, JSON.stringify(input.input || {})]);
  const [row] = await supabaseRest<UnknownRecord[]>(ctx.req, "automation_runs", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: ctx.workspaceId,
      workflow_id: input.workflowId,
      status: "queued",
      input: input.input || {},
      idempotency_key: idempotencyKey,
      created_by: input.createdBy || null,
      attempts: 0,
      max_attempts: 5,
      run_after: new Date().toISOString(),
    }),
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
  });
  if (row) return mapR(row);
  const existing = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "automation_runs",
    {},
    q({ workspace_id: `eq.${ctx.workspaceId}`, idempotency_key: `eq.${idempotencyKey}`, limit: "1" })
  );
  if (!existing[0]) throw new Error("Unable to create workflow run.");
  return mapR(existing[0]);
}
export async function listRuns(ctx: { req: NextRequest; workspaceId: string }, workflowId?: string) {
  const p: UnknownRecord = { workspace_id: `eq.${ctx.workspaceId}`, order: "created_at.desc", limit: "50" };
  if (workflowId) p.workflow_id = `eq.${workflowId}`;
  const rows = await supabaseRest<UnknownRecord[]>(ctx.req, "automation_runs", {}, q(p));
  return rows.map(mapR);
}
export async function updateRun(
  ctx: { req: NextRequest; workspaceId: string },
  id: string,
  input: { status: string; results?: unknown[]; error?: string; fromStatus?: string }
) {
  const patch: UnknownRecord = { status: input.status, results: input.results || [], error: input.error || null };
  if (input.status === "running") patch.started_at = new Date().toISOString();
  if (["succeeded", "failed", "cancelled"].includes(input.status)) patch.finished_at = new Date().toISOString();
  const filter: UnknownRecord = { workspace_id: `eq.${ctx.workspaceId}`, id: `eq.${id}` };
  if (input.fromStatus) filter.status = `eq.${input.fromStatus}`;
  const [row] = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "automation_runs",
    { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } },
    q(filter)
  );
  return row ? mapR(row) : null;
}
