import { isFreeBetaMode } from "../product/beta";
import { ALL_FEATURES_OFF, type FeatureKey, type FeatureMap, type UsageLimits } from "../product/features";

export type PlanSlug = "free" | "starter" | "pro" | "pro-plus" | "business" | "custom";
export type BillingInterval = "month" | "year";
export type PlanStatus = "active" | "hidden" | "retired";

export interface PlanDefinition {
  slug: PlanSlug;
  name: string;
  description: string;
  priceCents: number;
  currency: "USD";
  interval: BillingInterval;
  trialDays: number;
  features: FeatureMap;
  limits: UsageLimits;
  teamLimit: number;
  apiAccess: boolean;
  priority: boolean;
  supportLevel: "community" | "email" | "priority" | "dedicated";
  status: PlanStatus;
}

function features(enabled: FeatureKey[]): FeatureMap {
  const next = { ...ALL_FEATURES_OFF };
  for (const key of enabled) next[key] = true;
  return next;
}

const CORE_SEO: FeatureKey[] = ["website_seo.audit", "website_seo.crawl", "website_seo.technical", "keywords.research"];
const CONTENT: FeatureKey[] = ["content.generate", "content.refresh"];
const YOUTUBE_BASIC: FeatureKey[] = ["youtube.connect", "youtube.seo"];
const YOUTUBE_FULL: FeatureKey[] = [...YOUTUBE_BASIC, "youtube.analytics", "youtube.publish", "youtube.bulk"];
const FACEBOOK: FeatureKey[] = ["facebook.connect", "facebook.analytics", "facebook.publish"];
const AUTOMATION: FeatureKey[] = ["automation.basic", "automation.advanced"];
const AI_PLUS: FeatureKey[] = ["ai.strategist", "ai.action_center"];

export const PLAN_CATALOG: Record<PlanSlug, PlanDefinition> = {
  free: {
    slug: "free",
    name: "Free",
    description: "Basic SEO, limited YouTube, and limited AI for evaluation.",
    priceCents: 0,
    currency: "USD",
    interval: "month",
    trialDays: 0,
    features: features([...CORE_SEO, "youtube.connect", "youtube.seo", "content.generate"]),
    limits: {
      "ai.generations": 20,
      "seo.audits": 10,
      "keywords.research": 15,
      "youtube.analyses": 10,
      "youtube.publish": 2,
      "facebook.publish": 0,
      "automation.runs": 0,
    },
    teamLimit: 1,
    apiAccess: false,
    priority: false,
    supportLevel: "community",
    status: "active",
  },
  starter: {
    slug: "starter",
    name: "Starter",
    description: "More SEO usage, content generation, and basic YouTube publishing.",
    priceCents: 2900,
    currency: "USD",
    interval: "month",
    trialDays: 14,
    features: features([...CORE_SEO, ...CONTENT, ...YOUTUBE_BASIC, "youtube.publish"]),
    limits: {
      "ai.generations": 100,
      "seo.audits": 40,
      "keywords.research": 60,
      "youtube.analyses": 40,
      "youtube.publish": 20,
      "facebook.publish": 0,
      "automation.runs": 10,
    },
    teamLimit: 3,
    apiAccess: false,
    priority: false,
    supportLevel: "email",
    status: "active",
  },
  pro: {
    slug: "pro",
    name: "Pro",
    description: "Advanced SEO, YouTube analytics, Facebook, automation, and approvals.",
    priceCents: 7900,
    currency: "USD",
    interval: "month",
    trialDays: 14,
    features: features([...CORE_SEO, ...CONTENT, ...YOUTUBE_FULL, ...FACEBOOK, "automation.basic", "ai.strategist"]),
    limits: {
      "ai.generations": 400,
      "seo.audits": 120,
      "keywords.research": 200,
      "youtube.analyses": 150,
      "youtube.publish": 80,
      "facebook.publish": 80,
      "automation.runs": 80,
    },
    teamLimit: 8,
    apiAccess: false,
    priority: false,
    supportLevel: "email",
    status: "active",
  },
  "pro-plus": {
    slug: "pro-plus",
    name: "Pro+",
    description: "Bulk optimization, deeper analytics, advanced automation, and priority processing.",
    priceCents: 12900,
    currency: "USD",
    interval: "month",
    trialDays: 14,
    features: features([
      ...CORE_SEO,
      ...CONTENT,
      ...YOUTUBE_FULL,
      ...FACEBOOK,
      ...AUTOMATION,
      ...AI_PLUS,
      "priority.processing",
    ]),
    limits: {
      "ai.generations": 800,
      "seo.audits": 250,
      "keywords.research": 400,
      "youtube.analyses": 300,
      "youtube.publish": 200,
      "facebook.publish": 200,
      "automation.runs": 200,
    },
    teamLimit: 15,
    apiAccess: false,
    priority: true,
    supportLevel: "priority",
    status: "active",
  },
  business: {
    slug: "business",
    name: "Business",
    description: "Teams, larger usage, API access, and agency-ready controls.",
    priceCents: 24900,
    currency: "USD",
    interval: "month",
    trialDays: 14,
    features: features([
      ...CORE_SEO,
      ...CONTENT,
      ...YOUTUBE_FULL,
      ...FACEBOOK,
      ...AUTOMATION,
      ...AI_PLUS,
      "api.access",
      "priority.processing",
    ]),
    limits: {
      "ai.generations": 2000,
      "seo.audits": 800,
      "keywords.research": 1000,
      "youtube.analyses": 800,
      "youtube.publish": 500,
      "facebook.publish": 500,
      "automation.runs": 500,
    },
    teamLimit: 50,
    apiAccess: true,
    priority: true,
    supportLevel: "dedicated",
    status: "active",
  },
  custom: {
    slug: "custom",
    name: "Custom",
    description: "Custom limits, features, and pricing set by an administrator.",
    priceCents: 0,
    currency: "USD",
    interval: "month",
    trialDays: 0,
    features: features([
      ...CORE_SEO,
      ...CONTENT,
      ...YOUTUBE_FULL,
      ...FACEBOOK,
      ...AUTOMATION,
      ...AI_PLUS,
      "api.access",
    ]),
    limits: {
      "ai.generations": 5000,
      "seo.audits": 2000,
      "keywords.research": 2000,
      "youtube.analyses": 2000,
      "youtube.publish": 2000,
      "facebook.publish": 2000,
      "automation.runs": 2000,
    },
    teamLimit: 100,
    apiAccess: true,
    priority: true,
    supportLevel: "dedicated",
    status: "active",
  },
};

export const DEFAULT_TRIAL_PLAN: PlanSlug = "pro";
export const DEFAULT_FALLBACK_PLAN: PlanSlug = "free";
export const DEFAULT_TRIAL_DAYS = 14;

/** Free-beta entitlements. Billing stays off; paid catalog remains for later. */
export const BETA_PLAN: PlanDefinition = {
  slug: "free",
  name: "Nexora Free Beta",
  description: "Public free beta. Billing is off. YouTube-first with website SEO and limited Facebook.",
  priceCents: 0,
  currency: "USD",
  interval: "month",
  trialDays: 0,
  features: features([
    ...CORE_SEO,
    ...CONTENT,
    "youtube.connect",
    "youtube.seo",
    "youtube.analytics",
    "youtube.publish",
    ...FACEBOOK,
    "automation.basic",
    "ai.strategist",
  ]),
  limits: {
    "ai.generations": 80,
    "seo.audits": 40,
    "keywords.research": 60,
    "youtube.analyses": 60,
    "youtube.publish": 20,
    "facebook.publish": 15,
    "automation.runs": 20,
  },
  teamLimit: 5,
  apiAccess: false,
  priority: false,
  supportLevel: "community",
  status: "active",
};

export function defaultProvisionPlan(): PlanSlug {
  return isFreeBetaMode() ? "free" : DEFAULT_TRIAL_PLAN;
}

export function getPlan(slug: string | null | undefined): PlanDefinition {
  if (slug && slug in PLAN_CATALOG) return PLAN_CATALOG[slug as PlanSlug];
  return PLAN_CATALOG.free;
}

export function getGatingPlan(
  status: "trial" | "active" | "grace" | "restricted" | "canceled" | "past_due",
  slug?: string | null
): PlanDefinition {
  if (status === "restricted" || status === "canceled") return PLAN_CATALOG.free;
  if (isFreeBetaMode()) return BETA_PLAN;
  if (status === "grace" || status === "past_due") return PLAN_CATALOG.free;
  return getPlan(slug);
}

export function listActivePlans(): PlanDefinition[] {
  return Object.values(PLAN_CATALOG).filter((plan) => plan.status === "active");
}
