import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { isRoleResult, requireWorkspaceRole } from "@/lib/auth/rbac";
import { BillingNotConfiguredError, createCheckoutSession } from "@/lib/billing/adapter";
import { getTenantContext } from "@/lib/tenant";
import { productBrand } from "@/lib/product/brand";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { isFreeBetaMode } from "@/lib/product/beta";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { planSlug?: string };
  try {
    const session = await createCheckoutSession({
      workspaceId: tenant.workspaceId,
      planSlug: String(body.planSlug || "pro"),
      successUrl: `${productBrand.websiteUrl}/?billing=success`,
      cancelUrl: `${productBrand.websiteUrl}/?billing=cancel`,
    });
    await recordAuditEvent({
      workspaceId: tenant.workspaceId,
      actorUserId: tenant.user.id,
      action: "billing.checkout_started",
      entityType: "subscription",
      metadata: { planSlug: body.planSlug || "pro", provider: session.provider },
    });
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return NextResponse.json(
        {
          error: error.message,
          code: isFreeBetaMode() ? "BILLING_DISABLED_FOR_BETA" : "REQUIRES_CONFIGURATION",
        },
        { status: 501 }
      );
    }
    throw error;
  }
}
