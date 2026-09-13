import { NextRequest, NextResponse } from "next/server";
import { completeJob, failJob } from "@/lib/jobs/queue";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const expected = process.env.AUTOSEO_WORKER_SECRET;
  const supplied = req.headers.get("x-autoseo-worker-secret");
  if (!expected || !supplied || supplied !== expected)
    return NextResponse.json({ error: "Worker authentication failed." }, { status: 401 });
  const { id } = await params;
  const workerId = req.headers.get("x-worker-id");
  if (!workerId) return NextResponse.json({ error: "x-worker-id required." }, { status: 400 });
  try {
    const body = (await req.json()) as {
      success: boolean;
      error?: string;
      providerJobId?: string;
      attempt?: number;
      maxAttempts?: number;
    };
    if (body.success) {
      const job = await completeJob(id, workerId, { providerJobId: body.providerJobId });
      return NextResponse.json({ job });
    }
    const job = await failJob(id, workerId, body.attempt ?? 1, body.error || "Job failed.", body.maxAttempts ?? 5);
    return NextResponse.json({ job });
  } catch (error: unknown) {
    console.error("job completion error", error);
    return NextResponse.json({ error: "Job update failed." }, { status: 500 });
  }
}
