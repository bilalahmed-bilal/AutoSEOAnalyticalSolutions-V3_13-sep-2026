export const FEATURE_KEYS = [
  "website_seo.audit",
  "website_seo.crawl",
  "website_seo.technical",
  "keywords.research",
  "content.generate",
  "content.refresh",
  "youtube.connect",
  "youtube.analytics",
  "youtube.seo",
  "youtube.publish",
  "youtube.bulk",
  "facebook.connect",
  "facebook.analytics",
  "facebook.publish",
  "automation.basic",
  "automation.advanced",
  "ai.strategist",
  "ai.action_center",
  "api.access",
  "priority.processing",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const USAGE_METRICS = [
  "ai.generations",
  "seo.audits",
  "keywords.research",
  "youtube.analyses",
  "youtube.publish",
  "facebook.publish",
  "automation.runs",
] as const;

export type UsageMetric = (typeof USAGE_METRICS)[number];

export type FeatureMap = Record<FeatureKey, boolean>;
export type UsageLimits = Record<UsageMetric, number>;

export const ALL_FEATURES_OFF = Object.fromEntries(FEATURE_KEYS.map((key) => [key, false])) as FeatureMap;

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export function isUsageMetric(value: string): value is UsageMetric {
  return (USAGE_METRICS as readonly string[]).includes(value);
}
