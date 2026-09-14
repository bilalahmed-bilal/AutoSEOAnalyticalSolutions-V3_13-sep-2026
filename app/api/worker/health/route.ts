import { NextRequest, NextResponse } from "next/server";
import { checkWorkspaceConnections } from "@/lib/connections/health";
import { supabaseAdmin } from "@/lib/db/supabase-rest";

export async function POST(req: NextRequest) {
  const expected = process.env.AUTOSEO_WORKER_SECRET;
  if (!expected || req.headers.get("x-autoseo-worker-secret") !== expected)
    return NextResponse.json({ error: "Worker authentication failed." }, { status: 401 });
  const workspaceId = req.headers.get("x-workspace-id")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "x-workspace-id required." }, { status: 400 });
  const allowlist = (process.env.AUTOSEO_WORKER_WORKSPACE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowlist.length && !allowlist.includes(workspaceId)) {
    return NextResponse.json({ error: "Workspace is not bound to this worker." }, { status: 403 });
  }
  try {
    const rows = await supabaseAdmin<{ id: string }[]>(
      "workspaces",
      { method: "GET" },
      `?id=eq.${encodeURIComponent(workspaceId)}&select=id`
    );
    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: "Unknown workspace." }, { status: 404 });
    }
  } catch (error) {
    console.error("worker health workspace lookup failed", error);
    return NextResponse.json({ error: "Workspace could not be verified." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, results: await checkWorkspaceConnections(workspaceId) });
}
