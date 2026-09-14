import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { isRoleResult, requireWorkspaceRole } from "@/lib/auth/rbac";
import { ensureWorkspaceSubscription } from "@/lib/billing/entitlements";
import { listUsage } from "@/lib/billing/usage";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { getTenantContext } from "@/lib/tenant";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) {
    return NextResponse.json({
      empty: true,
      message: "Sign in and create a workspace to see live dashboard metrics.",
    });
  }
  const permission = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });

  const [jobs, connections, drafts, seo, subscription, usage] = await Promise.all([
    supabaseRest<UnknownRecord[]>(
      req,
      "jobs",
      {},
      `?workspace_id=eq.${tenant.workspaceId}&select=id,type,status,last_error,created_at&order=created_at.desc&limit=20`
    ).catch(() => []),
    supabaseRest<UnknownRecord[]>(
      req,
      "connections",
      {},
      `?workspace_id=eq.${tenant.workspaceId}&select=id,provider,status,last_error,last_checked_at&status=neq.revoked`
    ).catch(() => []),
    supabaseRest<UnknownRecord[]>(
      req,
      "drafts",
      {},
      `?workspace_id=eq.${tenant.workspaceId}&select=id,status,channel,title,created_at&order=created_at.desc&limit=10`
    ).catch(() => []),
    supabaseRest<UnknownRecord[]>(
      req,
      "seo_score_history",
      {},
      `?workspace_id=eq.${tenant.workspaceId}&select=url,score,created_at&order=created_at.desc&limit=5`
    ).catch(() => []),
    ensureWorkspaceSubscription(tenant.workspaceId),
    listUsage(tenant.workspaceId),
  ]);

  return NextResponse.json({
    seoHealth: seo[0] || null,
    seoHistory: seo,
    topIssues: [],
    pendingApprovals: drafts.filter((d) => d.status === "pending").length,
    scheduledActions: jobs.filter((j) => j.status === "queued").length,
    connectedAccounts: connections,
    recentContent: drafts,
    automationStatus: {
      queued: jobs.filter((j) => j.status === "queued").length,
      running: jobs.filter((j) => j.status === "running").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    },
    usage,
    subscription: {
      plan: subscription.plan.slug,
      name: subscription.plan.name,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      catalogOnly: subscription.catalogOnly,
    },
  });
}
