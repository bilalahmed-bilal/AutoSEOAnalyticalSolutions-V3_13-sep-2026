import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { normalizeSteps } from "@/lib/automation-workflows";
import { executeWorkflowSteps } from "@/lib/automation-executor";
import { nextRetryAt } from "@/lib/jobs/idempotency";
import { type UnknownRecord } from "@/lib/unknown";

type AutomationRunRow = {
  id: string;
  workspace_id: string;
  workflow_id: string;
  status: string;
  input: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
};

function systemRequest(workspaceId: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return new NextRequest("http://autoseo.internal/api/worker/automation", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "x-workspace-id": workspaceId,
    },
  });
}

export function newAutomationWorkerId(prefix = "autoseo-automation") {
  return `${prefix}-${process.pid}-${crypto.randomUUID()}`;
}

async function claimNextAutomationRun(workerId: string): Promise<AutomationRunRow | null> {
  const result = await supabaseAdmin<AutomationRunRow | AutomationRunRow[]>("rpc/claim_next_automation_run", {
    method: "POST",
    body: JSON.stringify({ p_worker_id: workerId }),
  });
  return Array.isArray(result) ? (result[0] ?? null) : (result ?? null);
}

async function finishRun(run: AutomationRunRow, results: unknown[]) {
  const rows = await supabaseAdmin<AutomationRunRow[]>(
    "automation_runs",
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "succeeded",
        results,
        error: null,
        finished_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=representation" },
    },
    `?id=eq.${encodeURIComponent(run.id)}&status=eq.running&locked_by=eq.${encodeURIComponent(run.locked_by ?? "")}`
  );
  return Boolean(rows[0]);
}

async function failRun(run: AutomationRunRow, error: string) {
  const terminal = run.attempts >= run.max_attempts;
  const patch = terminal
    ? {
        status: "failed",
        error: error.slice(0, 2000),
        finished_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      }
    : {
        status: "queued",
        error: error.slice(0, 2000),
        run_after: nextRetryAt(run.attempts).toISOString(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      };
  const rows = await supabaseAdmin<AutomationRunRow[]>(
    "automation_runs",
    {
      method: "PATCH",
      body: JSON.stringify(patch),
      headers: { Prefer: "return=representation" },
    },
    `?id=eq.${encodeURIComponent(run.id)}&status=eq.running&locked_by=eq.${encodeURIComponent(run.locked_by ?? "")}`
  );
  return { updated: Boolean(rows[0]), terminal };
}

export async function processAutomationRunBatch(limit = 5) {
  const workerId = newAutomationWorkerId();
  const results: Array<Record<string, unknown>> = [];
  const safeLimit = Math.max(1, Math.min(limit, 20));

  for (let i = 0; i < safeLimit; i += 1) {
    const run = await claimNextAutomationRun(workerId);
    if (!run) break;

    try {
      const workflows = await supabaseAdmin<UnknownRecord[]>(
        "automation_workflows",
        {},
        `?id=eq.${encodeURIComponent(run.workflow_id)}&workspace_id=eq.${encodeURIComponent(run.workspace_id)}&limit=1`
      );
      const workflow = workflows[0];
      if (!workflow) {
        const failed = await failRun(run, "Workflow not found.");
        results.push({ runId: run.id, status: failed.terminal ? "failed" : "retrying", attempts: run.attempts });
        continue;
      }
      if (workflow.status !== "active") {
        await supabaseAdmin(
          "automation_runs",
          {
            method: "PATCH",
            body: JSON.stringify({
              status: "cancelled",
              error: "Workflow is not active.",
              finished_at: new Date().toISOString(),
              locked_at: null,
              locked_by: null,
              updated_at: new Date().toISOString(),
            }),
            headers: { Prefer: "return=minimal" },
          },
          `?id=eq.${encodeURIComponent(run.id)}&status=eq.running&locked_by=eq.${encodeURIComponent(workerId)}`
        );
        results.push({ runId: run.id, status: "cancelled", attempts: run.attempts });
        continue;
      }

      const req = systemRequest(run.workspace_id);
      const stepResults = await executeWorkflowSteps(
        { req, workspaceId: run.workspace_id },
        normalizeSteps(workflow.steps),
        run.input ?? {}
      );
      const failedStep = stepResults.find((step: UnknownRecord) => step.status === "failed");
      if (failedStep) {
        const failed = await failRun(
          run,
          `Workflow step ${String((failedStep as UnknownRecord).stepId ?? "unknown")} failed: ${String((failedStep as UnknownRecord).error ?? "Unknown error")}`
        );
        results.push({
          runId: run.id,
          status: failed.terminal ? "failed" : "retrying",
          attempts: run.attempts,
          results: stepResults,
        });
      } else {
        await finishRun(run, stepResults);
        results.push({ runId: run.id, status: "succeeded", attempts: run.attempts, results: stepResults });
      }
    } catch (error) {
      const failed = await failRun(run, error instanceof Error ? error.message : String(error));
      results.push({
        runId: run.id,
        status: failed.terminal ? "failed" : "retrying",
        attempts: run.attempts,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { workerId, claimed: results.length, results };
}
