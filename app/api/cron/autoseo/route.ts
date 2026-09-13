import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { processPublishBatch } from "@/lib/jobs/process-publish";
import { scheduleDueWorkflows } from "@/lib/automation/scheduler";
import { processAutomationRunBatch } from "@/lib/automation-worker";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Cron authentication failed." }, { status: 401 });

  let recovered = 0;
  try {
    recovered = Number(
      await supabaseAdmin<number>("rpc/recover_stale_jobs", {
        method: "POST",
        body: JSON.stringify({ p_stale_after: "10 minutes" }),
      })
    );
  } catch (e) {
    console.error("stale job recovery failed", e);
  }
  let automation;
  try {
    automation = await scheduleDueWorkflows(20);
  } catch (e) {
    console.error("automation scheduler failed", e);
    automation = { checked: 0, queued: 0, skipped: 0, error: "scheduler_failed" };
  }
  let automationWorker;
  try {
    try {
      await supabaseAdmin<number>("rpc/recover_stale_automation_runs", {
        method: "POST",
        body: JSON.stringify({ p_stale_after: "10 minutes" }),
      });
    } catch (e) {
      console.error("stale automation recovery failed", e);
    }
    automationWorker = await processAutomationRunBatch(5);
  } catch (e) {
    console.error("automation worker failed", e);
    automationWorker = { claimed: 0, results: [], error: "worker_failed" };
  }
  const results = await processPublishBatch(5);
  return NextResponse.json({
    ok: true,
    recovered,
    automation,
    automationWorker,
    processed: results.filter((r) => r.claimed).length,
    results,
  });
}
