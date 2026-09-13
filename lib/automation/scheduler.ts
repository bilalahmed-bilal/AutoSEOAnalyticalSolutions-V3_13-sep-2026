import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { createIdempotencyKey } from "@/lib/jobs/idempotency";
import { type UnknownRecord } from "@/lib/unknown";

type ScheduledWorkflow = {
  id: string;
  workspace_id: string;
  schedule: string;
  status: string;
  trigger_type: string;
  next_run_at: string | null;
};

function nextOccurrence(schedule: string, from: Date): Date | null {
  const s = schedule.trim().toLowerCase();
  if (s === "hourly") return new Date(from.getTime() + 60 * 60 * 1000);
  const every = s.match(/^every\s+(\d+)\s+(minute|minutes|hour|hours|day|days)$/);
  if (every) {
    const n = Number(every[1]);
    const unit = every[2];
    if (!Number.isFinite(n) || n < 1) return null;
    const ms = unit.startsWith("minute") ? n * 60_000 : unit.startsWith("hour") ? n * 3_600_000 : n * 86_400_000;
    return new Date(from.getTime() + ms);
  }
  const daily = s.match(/^(?:daily|every day)(?:\s+at)?\s+(\d{1,2}):(\d{2})$/);
  if (daily) {
    const hour = Number(daily[1]),
      minute = Number(daily[2]);
    if (hour > 23 || minute > 59) return null;
    const d = new Date(from);
    d.setHours(hour, minute, 0, 0);
    if (d <= from) d.setDate(d.getDate() + 1);
    return d;
  }
  // ISO timestamp is useful for one-time scheduled workflows.
  const iso = new Date(schedule);
  if (!Number.isNaN(iso.getTime())) return iso > from ? iso : null;
  return null;
}

export async function scheduleDueWorkflows(limit = 20) {
  const now = new Date();
  const workflows = await supabaseAdmin<ScheduledWorkflow[]>(
    "automation_workflows",
    {},
    `?status=eq.active&trigger_type=eq.schedule&next_run_at=lte.${encodeURIComponent(now.toISOString())}&order=next_run_at.asc&limit=${Math.max(1, Math.min(limit, 50))}`
  );
  const created: string[] = [];
  const skipped: string[] = [];

  for (const workflow of workflows) {
    const dueAt = workflow.next_run_at ? new Date(workflow.next_run_at) : now;
    const input = { scheduledAt: dueAt.toISOString(), trigger: "schedule" };
    const idempotencyKey = createIdempotencyKey([
      "automation_schedule",
      workflow.workspace_id,
      workflow.id,
      dueAt.toISOString(),
    ]);
    const rows = await supabaseAdmin<UnknownRecord[]>("automation_runs", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workflow.workspace_id,
        workflow_id: workflow.id,
        status: "queued",
        input,
        idempotency_key: idempotencyKey,
      }),
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    });
    if (rows[0]) created.push(workflow.id);
    else skipped.push(workflow.id);

    const next = nextOccurrence(workflow.schedule, now);
    await supabaseAdmin(
      "automation_workflows",
      {
        method: "PATCH",
        body: JSON.stringify({
          last_run_at: now.toISOString(),
          next_run_at: next?.toISOString() ?? null,
          updated_at: now.toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      },
      `?id=eq.${encodeURIComponent(workflow.id)}&workspace_id=eq.${encodeURIComponent(workflow.workspace_id)}&status=eq.active&next_run_at=eq.${encodeURIComponent(workflow.next_run_at ?? "")}`
    );
  }
  return { checked: workflows.length, queued: created.length, skipped: skipped.length };
}

export function getNextScheduledRun(schedule: string, from = new Date()) {
  return nextOccurrence(schedule, from);
}
