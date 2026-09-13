import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;

  const [workspaces, subscriptions, jobs, connections] = await Promise.all([
    supabaseAdmin<UnknownRecord[]>("workspaces", {}, "?select=id,status&limit=1000").catch(() => []),
    supabaseAdmin<UnknownRecord[]>("workspace_subscriptions", {}, "?select=status,plan_slug&limit=1000").catch(
      () => []
    ),
    supabaseAdmin<UnknownRecord[]>("jobs", {}, "?select=id,status&limit=500").catch(() => []),
    supabaseAdmin<UnknownRecord[]>("connections", {}, "?select=id,status,provider&limit=1000").catch(() => []),
  ]);

  return NextResponse.json({
    workspaces: workspaces.length,
    suspendedWorkspaces: workspaces.filter((row) => row.status === "suspended").length,
    trialWorkspaces: subscriptions.filter((row) => row.status === "trial").length,
    paidWorkspaces: subscriptions.filter((row) => row.status === "active").length,
    failedJobs: jobs.filter((row) => row.status === "failed").length,
    connectedAccounts: connections.filter((row) => row.status !== "revoked").length,
    note: "Counts are live database values. MRR is omitted until a billing provider is configured.",
  });
}
