import { isApiAuthRequired } from "@/lib/auth/policy";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { isFreeBetaMode } from "@/lib/product/beta";
import {
  DEFAULT_FALLBACK_PLAN,
  DEFAULT_TRIAL_DAYS,
  defaultProvisionPlan,
  getGatingPlan,
  type PlanDefinition,
  type PlanSlug,
} from "@/lib/billing/catalog";
import { applyOverrides } from "@/lib/billing/overrides";
import { FEATURE_KEYS, type FeatureKey, type FeatureMap, type UsageMetric } from "@/lib/product/features";
import { type UnknownRecord } from "@/lib/unknown";

export { applyOverrides };

export type SubscriptionStatus = "trial" | "active" | "grace" | "restricted" | "canceled" | "past_due";
export type OverrideEffect = "grant" | "revoke" | "limit";

export interface EntitlementDecision {
  allowed: boolean;
  feature: FeatureKey;
  plan: PlanSlug;
  status: SubscriptionStatus;
  reason: string;
  code: "ok" | "feature_denied" | "plan_restricted" | "usage_exceeded" | "workspace_suspended" | "schema_required";
  statusCode: number;
  remaining?: number;
  limit?: number;
  used?: number;
  catalogOnly: boolean;
}

export interface WorkspaceEntitlements {
  plan: PlanDefinition;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  periodStart: string;
  periodEnd: string;
  features: FeatureMap;
  catalogOnly: boolean;
  workspaceId: string;
}

function periodBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

function emptyFeatures(): FeatureMap {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, false])) as FeatureMap;
}

export function deriveSubscriptionStatus(row: {
  status?: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}): SubscriptionStatus {
  const now = Date.now();
  const status = String(row.status || "trial") as SubscriptionStatus;
  if (status === "canceled") return "canceled";
  if (status === "restricted") return "restricted";
  if (status === "past_due") return "past_due";
  if (row.trial_ends_at && Date.parse(row.trial_ends_at) < now && status === "trial") return "grace";
  if (row.current_period_end && Date.parse(row.current_period_end) < now && status === "active") return "past_due";
  return status;
}

function catalogOnlyWorkspace(workspaceId: string, planSlug: PlanSlug = defaultProvisionPlan()): WorkspaceEntitlements {
  const plan = getGatingPlan("trial", planSlug);
  const { periodStart, periodEnd } = periodBounds();
  return {
    plan,
    status: "trial",
    trialEndsAt: isFreeBetaMode() ? null : new Date(Date.now() + DEFAULT_TRIAL_DAYS * 86400000).toISOString(),
    periodStart,
    periodEnd,
    features: { ...plan.features },
    catalogOnly: true,
    workspaceId,
  };
}

async function schemaQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/schema cache|does not exist|42P01|PGRST205/i.test(message)) return null;
    throw error;
  }
}

export async function ensureWorkspaceSubscription(workspaceId: string): Promise<WorkspaceEntitlements> {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    return catalogOnlyWorkspace(workspaceId, defaultProvisionPlan());
  }
  const existing = await schemaQuery(() =>
    supabaseAdmin<UnknownRecord[]>(
      "workspace_subscriptions",
      {},
      `?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*&limit=1`
    )
  );
  if (existing === null) {
    if (isApiAuthRequired() && !isFreeBetaMode()) {
      return {
        ...catalogOnlyWorkspace(workspaceId, DEFAULT_FALLBACK_PLAN),
        status: "restricted",
        features: emptyFeatures(),
      };
    }
    return catalogOnlyWorkspace(workspaceId);
  }

  let row = existing[0];
  if (!row) {
    const provisionPlan = defaultProvisionPlan();
    const trialEnds = isFreeBetaMode() ? null : new Date(Date.now() + DEFAULT_TRIAL_DAYS * 86400000).toISOString();
    const { periodStart, periodEnd } = periodBounds();
    const created = await schemaQuery(() =>
      supabaseAdmin<UnknownRecord[]>("workspace_subscriptions", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          plan_slug: provisionPlan,
          status: "trial",
          trial_ends_at: trialEnds,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        }),
        headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      })
    );
    row = created?.[0] || {
      plan_slug: provisionPlan,
      status: "trial",
      trial_ends_at: trialEnds,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    };
  }

  const status = deriveSubscriptionStatus({
    status: String(row.status || "trial"),
    trial_ends_at: row.trial_ends_at ? String(row.trial_ends_at) : null,
    current_period_end: row.current_period_end ? String(row.current_period_end) : null,
  });
  const plan = getGatingPlan(status, String(row.plan_slug));
  const overrides =
    (await schemaQuery(() =>
      supabaseAdmin<UnknownRecord[]>(
        "entitlement_overrides",
        {},
        `?workspace_id=eq.${encodeURIComponent(workspaceId)}&or=(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`
      )
    )) || [];

  return {
    plan,
    status,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    periodStart: String(row.current_period_start || periodBounds().periodStart),
    periodEnd: String(row.current_period_end || periodBounds().periodEnd),
    features: applyOverrides(
      { ...plan.features },
      overrides as Array<{ feature_key: string; effect: string; expires_at?: string | null }>
    ),
    catalogOnly: false,
    workspaceId,
  };
}

export async function evaluateFeature(
  workspaceId: string,
  feature: FeatureKey,
  usage?: { metric: UsageMetric; used: number }
): Promise<EntitlementDecision> {
  const snapshot = await ensureWorkspaceSubscription(workspaceId);
  if (snapshot.status === "restricted" && snapshot.catalogOnly && isApiAuthRequired() && !isFreeBetaMode()) {
    return {
      allowed: false,
      feature,
      plan: snapshot.plan.slug,
      status: snapshot.status,
      reason: "Subscription schema is not applied. Billing is required in this environment.",
      code: "schema_required",
      statusCode: 503,
      catalogOnly: true,
    };
  }
  if (!snapshot.features[feature]) {
    return {
      allowed: false,
      feature,
      plan: snapshot.plan.slug,
      status: snapshot.status,
      reason: `Plan ${snapshot.plan.name} does not include ${feature}. Upgrade or ask an admin for access.`,
      code: snapshot.status === "restricted" ? "plan_restricted" : "feature_denied",
      statusCode: 403,
      catalogOnly: snapshot.catalogOnly,
    };
  }
  if (usage) {
    const limit = snapshot.plan.limits[usage.metric];
    if (Number.isFinite(limit) && usage.used >= limit) {
      return {
        allowed: false,
        feature,
        plan: snapshot.plan.slug,
        status: snapshot.status,
        reason: `Usage limit reached for ${usage.metric} (${usage.used}/${limit}).`,
        code: "usage_exceeded",
        statusCode: 429,
        remaining: 0,
        limit,
        used: usage.used,
        catalogOnly: snapshot.catalogOnly,
      };
    }
    return {
      allowed: true,
      feature,
      plan: snapshot.plan.slug,
      status: snapshot.status,
      reason: "ok",
      code: "ok",
      statusCode: 200,
      remaining: Math.max(0, limit - usage.used),
      limit,
      used: usage.used,
      catalogOnly: snapshot.catalogOnly,
    };
  }
  return {
    allowed: true,
    feature,
    plan: snapshot.plan.slug,
    status: snapshot.status,
    reason: "ok",
    code: "ok",
    statusCode: 200,
    catalogOnly: snapshot.catalogOnly,
  };
}
