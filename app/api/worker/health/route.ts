import { NextRequest, NextResponse } from "next/server";
import { checkWorkspaceConnections } from "@/lib/connections/health";

export async function POST(req: NextRequest) {
  const expected = process.env.AUTOSEO_WORKER_SECRET;
  if (!expected || req.headers.get("x-autoseo-worker-secret") !== expected)
    return NextResponse.json({ error: "Worker authentication failed." }, { status: 401 });
  const workspaceId = req.headers.get("x-workspace-id");
  if (!workspaceId) return NextResponse.json({ error: "x-workspace-id required." }, { status: 400 });
  return NextResponse.json({ ok: true, results: await checkWorkspaceConnections(workspaceId) });
}
