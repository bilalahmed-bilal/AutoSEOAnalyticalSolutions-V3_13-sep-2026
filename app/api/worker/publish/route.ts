import { NextRequest, NextResponse } from "next/server";
import { processOnePublishJob } from "@/lib/jobs/process-publish";
import { newWorkerId } from "@/lib/jobs/queue";

export async function POST(req: NextRequest) {
  const expected = process.env.AUTOSEO_WORKER_SECRET;
  if (!expected || req.headers.get("x-autoseo-worker-secret") !== expected) {
    return NextResponse.json({ error: "Worker authentication failed." }, { status: 401 });
  }
  const workerId = req.headers.get("x-worker-id") || newWorkerId("publish-api");
  const result = await processOnePublishJob(workerId);
  return NextResponse.json(result, { status: result.claimed && result.success === false ? 500 : 200 });
}
