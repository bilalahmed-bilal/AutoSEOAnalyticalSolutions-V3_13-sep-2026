import { NextRequest, NextResponse } from "next/server";
import { claimNextJob, newWorkerId } from "@/lib/jobs/queue";

export async function POST(req: NextRequest) {
  const expected = process.env.AUTOSEO_WORKER_SECRET;
  const supplied = req.headers.get("x-autoseo-worker-secret");
  if (!expected || !supplied || supplied !== expected) return NextResponse.json({ error: "Worker authentication failed." }, { status: 401 });
  try {
    const workerId = req.headers.get("x-worker-id") || newWorkerId();
    const job = await claimNextJob(workerId);
    return NextResponse.json({ job, workerId });
  } catch (error: any) {
    console.error("job claim error", error);
    return NextResponse.json({ error: "Job claim failed." }, { status: 500 });
  }
}
