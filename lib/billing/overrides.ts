import { FEATURE_KEYS, type FeatureKey, type FeatureMap } from "../product/features";

export function applyOverrides(
  base: FeatureMap,
  overrides: Array<{ feature_key: string; effect: string; expires_at?: string | null }>
): FeatureMap {
  const next = { ...base };
  const now = Date.now();
  for (const override of overrides) {
    if (override.expires_at && Date.parse(override.expires_at) <= now) continue;
    if (!(FEATURE_KEYS as readonly string[]).includes(override.feature_key)) continue;
    const key = override.feature_key as FeatureKey;
    if (override.effect === "grant") next[key] = true;
    if (override.effect === "revoke") next[key] = false;
  }
  return next;
}
