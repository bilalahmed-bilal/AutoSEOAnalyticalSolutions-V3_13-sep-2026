import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { isRoleResult, requireWorkspaceRole } from "@/lib/auth/rbac";
import { ensureWorkspaceSubscription } from "@/lib/billing/entitlements";
import { listUsage, usagePersistenceMode } from "@/lib/billing/usage";
import { USAGE_METRICS } from "@/lib/product/features";
import { getTenantContext } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ usage: [], limits: {} });
  const permission = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const snapshot = await ensureWorkspaceSubscription(tenant.workspaceId);
  const rows = await listUsage(tenant.workspaceId);
  const used = Object.fromEntries(rows.map((row) => [String(row.metric), Number(row.quantity || 0)]));
  return NextResponse.json({
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    metering: snapshot.catalogOnly ? "DEVELOPMENT_ONLY" : usagePersistenceMode(),
    metrics: USAGE_METRICS.map((metric) => ({
      metric,
      used: used[metric] || 0,
      limit: snapshot.plan.limits[metric],
    })),
  });
}
