/**
 * Provider-independent billing adapter.
 * Browser payment status is never trusted. No live provider is configured yet.
 * AIBISORA Free Beta keeps billing OFF.
 */
import { isFreeBetaMode } from "@/lib/product/beta";
export type BillingProviderId = "none" | "gopayfast" | "rapid-gateway";

export class BillingNotConfiguredError extends Error {
  constructor(message = "Billing provider is not configured.") {
    super(message);
    this.name = "BillingNotConfiguredError";
  }
}

export function configuredBillingProvider(): BillingProviderId {
  const value = (process.env.NEXORA_BILLING_PROVIDER || "none").trim().toLowerCase();
  if (value === "gopayfast" || value === "rapid-gateway") return value;
  return "none";
}

export async function createCheckoutSession(_input: {
  workspaceId: string;
  planSlug: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ checkoutUrl: string; provider: BillingProviderId }> {
  void _input;
  if (isFreeBetaMode()) {
    throw new BillingNotConfiguredError("Billing is off for AIBISORA Free Beta.");
  }
  const provider = configuredBillingProvider();
  if (provider === "none") throw new BillingNotConfiguredError();
  throw new BillingNotConfiguredError(`${provider} adapter is registered but credentials are not configured.`);
}

export async function reconcileWebhook(payload: unknown): Promise<{ ok: boolean; message: string }> {
  void payload;
  throw new BillingNotConfiguredError("Webhook reconciliation requires a configured billing provider.");
}
