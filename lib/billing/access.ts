import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse, type ApiAccess } from "@/lib/auth/api-access";
import { isRoleResult, requireWorkspaceRole, type WorkspaceRole } from "@/lib/auth/rbac";
import { evaluateFeature, type EntitlementDecision } from "@/lib/billing/entitlements";
import { getUsageCount, incrementUsage } from "@/lib/billing/usage";
import { type FeatureKey, type UsageMetric } from "@/lib/product/features";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type TenantContext } from "@/lib/tenant";

export interface ProductAccess {
  access: ApiAccess;
  tenant: TenantContext | null;
  role: WorkspaceRole | "demo";
  decision: EntitlementDecision;
  consume: () => Promise<void>;
}

export function isProductAccess(value: unknown): value is ProductAccess {
  return Boolean(value && typeof value === "object" && "decision" in value && "consume" in value);
}

export function entitlementResponse(decision: EntitlementDecision) {
  return NextResponse.json(
    { error: decision.reason, code: decision.code, feature: decision.feature, plan: decision.plan },
    { status: decision.statusCode }
  );
}

async function workspaceIsSuspended(workspaceId: string): Promise<boolean> {
  try {
    const rows = await supabaseAdmin<Array<{ status?: string }>>(
      "workspaces",
      {},
      `?id=eq.${encodeURIComponent(workspaceId)}&select=status&limit=1`
    );
    return rows[0]?.status === "suspended";
  } catch {
    return false;
  }
}

export async function requireProductAccess(
  req: NextRequest,
  options: {
    feature: FeatureKey;
    minRole?: WorkspaceRole;
    usageMetric?: UsageMetric;
    increment?: number;
  }
): Promise<ProductAccess | NextResponse> {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();

  if (!access.authenticated) {
    const used = options.usageMetric ? await getUsageCount("anonymous-local", options.usageMetric) : 0;
    const decision = await evaluateFeature(
      "anonymous-local",
      options.feature,
      options.usageMetric ? { metric: options.usageMetric, used } : undefined
    );
    if (!decision.allowed) return entitlementResponse(decision);
    return {
      access,
      tenant: null,
      role: "demo",
      decision,
      consume: async () => {
        if (options.usageMetric)
          await incrementUsage("anonymous-local", options.usageMetric, options.increment ?? 1, access.user.id);
      },
    };
  }

  const roleResult = await requireWorkspaceRole(req, options.minRole || "viewer");
  if (!isRoleResult(roleResult)) return roleResult;
  if (await workspaceIsSuspended(roleResult.tenant.workspaceId)) {
    return NextResponse.json({ error: "This workspace is suspended." }, { status: 403 });
  }

  const used = options.usageMetric ? await getUsageCount(roleResult.tenant.workspaceId, options.usageMetric) : 0;
  const decision = await evaluateFeature(
    roleResult.tenant.workspaceId,
    options.feature,
    options.usageMetric ? { metric: options.usageMetric, used } : undefined
  );
  if (!decision.allowed) return entitlementResponse(decision);

  return {
    access,
    tenant: roleResult.tenant,
    role: roleResult.role,
    decision,
    consume: async () => {
      if (options.usageMetric) {
        await incrementUsage(
          roleResult.tenant.workspaceId,
          options.usageMetric,
          options.increment ?? 1,
          roleResult.tenant.user.id
        );
      }
    },
  };
}
