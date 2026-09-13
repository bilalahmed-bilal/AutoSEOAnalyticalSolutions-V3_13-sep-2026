import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { isRoleResult, requireWorkspaceRole } from "@/lib/auth/rbac";
import { ensureWorkspaceSubscription } from "@/lib/billing/entitlements";
import { listActivePlans } from "@/lib/billing/catalog";
import { isFreeBetaMode } from "@/lib/product/beta";
import { getTenantContext } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) {
    return NextResponse.json({ subscription: null, plans: listActivePlans().map(publicPlan) });
  }
  const permission = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const snapshot = await ensureWorkspaceSubscription(tenant.workspaceId);
  return NextResponse.json({
    subscription: {
      plan: snapshot.plan.slug,
      name: snapshot.plan.name,
      status: snapshot.status,
      trialEndsAt: snapshot.trialEndsAt,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      features: snapshot.features,
      limits: snapshot.plan.limits,
      catalogOnly: snapshot.catalogOnly,
      beta: isFreeBetaMode(),
      billing: isFreeBetaMode() ? "OFF" : "REQUIRES_CONFIGURATION",
    },
    plans: listActivePlans().map(publicPlan),
  });
}

function publicPlan(plan: ReturnType<typeof listActivePlans>[number]) {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    interval: plan.interval,
    trialDays: plan.trialDays,
  };
}
