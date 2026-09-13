/**
 * Nexora Free Beta launch mode.
 *
 * Billing and paid checkout stay off until a payment provider is configured
 * and NEXORA_BETA_MODE is explicitly set to "false".
 */
type BetaEnv = {
  NEXORA_BETA_MODE?: string;
  NEXORA_BILLING_PROVIDER?: string;
};

export function isFreeBetaMode(env: BetaEnv = process.env as BetaEnv): boolean {
  if (env.NEXORA_BETA_MODE === "false") return false;
  const billing = (env.NEXORA_BILLING_PROVIDER || "none").trim().toLowerCase();
  if (billing !== "none" && env.NEXORA_BETA_MODE !== "true") return false;
  return true;
}

export function billingActivationStatus(env: BetaEnv = process.env as BetaEnv): "OFF" | "REQUIRES_CONFIGURATION" {
  if (isFreeBetaMode(env)) return "OFF";
  return "REQUIRES_CONFIGURATION";
}
