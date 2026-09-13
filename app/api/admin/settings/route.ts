import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { isFreeBetaMode, billingActivationStatus } from "@/lib/product/beta";
import { configuredBillingProvider } from "@/lib/billing/adapter";
import { RATE_LIMIT_BACKEND } from "@/lib/security/rate-limit";
import { FEATURE_KEYS } from "@/lib/product/features";
import { BETA_PLAN } from "@/lib/billing/catalog";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  return NextResponse.json({
    product: "Nexora",
    beta: isFreeBetaMode(),
    billing: billingActivationStatus(),
    billingProvider: configuredBillingProvider(),
    rateLimitBackend: RATE_LIMIT_BACKEND,
    rateLimitNote: "Distributed rate limiting REQUIRES_PRODUCTION_INFRASTRUCTURE.",
    facebookPageSelection: "FIRST_PAGE_ONLY",
    session: "HttpOnly cookies plus optional Bearer fallback",
    featureKeys: FEATURE_KEYS,
    betaPlan: {
      name: BETA_PLAN.name,
      slug: BETA_PLAN.slug,
      limits: BETA_PLAN.limits,
    },
    secretsExposed: false,
  });
}
