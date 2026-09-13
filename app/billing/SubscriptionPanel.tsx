"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";

export default function SubscriptionPanel() {
  const [subscription, setSubscription] = useState<UnknownRecord | null>(null);
  const [usage, setUsage] = useState<UnknownRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  useEffect(
    () =>
      scheduleMount(() => {
        Promise.all([apiFetch("/api/billing/subscription"), apiFetch("/api/billing/usage")])
          .then(async ([subRes, usageRes]) => {
            const sub = await subRes.json();
            const use = await usageRes.json();
            if (!subRes.ok) throw new Error(sub.error || "Subscription load failed.");
            if (!usageRes.ok) throw new Error(use.error || "Usage load failed.");
            setSubscription(sub.subscription);
            setUsage(use.metrics || []);
          })
          .catch((err: unknown) => setError(errorMessage(err, "Billing data load failed.")));
      }),
    []
  );

  async function checkout() {
    setCheckoutMessage(null);
    const res = await apiFetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug: "pro" }),
    });
    const data = await res.json();
    setCheckoutMessage(data.error || "Checkout is not configured.");
  }

  return (
    <div className="space-y-4">
      <section className="border border-line bg-white p-6">
        <h2 className="font-head text-lg font-semibold">Subscription</h2>
        <p className="mt-1 text-sm text-ink/60">Nexora Free Beta — billing and paid checkout are OFF.</p>
        {error && <p className="mt-3 border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {subscription ? (
          <div className="mt-3 text-sm">
            <p>
              Plan: <strong>{String(subscription.name)}</strong> ({String(subscription.status)})
            </p>
            {subscription.trialEndsAt ? (
              <p className="mt-1">Trial ends: {new Date(String(subscription.trialEndsAt)).toLocaleString()}</p>
            ) : null}
            {subscription.catalogOnly ? (
              <p className="mt-2 text-ink/60">
                Catalog-only mode: apply `supabase/v46-nexora-saas.sql` to persist subscriptions.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/50">No subscription loaded.</p>
        )}
        {subscription?.billing && subscription.billing !== "OFF" && !subscription.beta ? (
          <button onClick={checkout} className="mt-4 border-2 border-ink bg-signal px-4 py-2 text-sm">
            Upgrade via billing provider
          </button>
        ) : (
          <p className="mt-4 border border-line bg-paper p-3 text-sm">
            Payments are disabled for this beta. Feature access comes from the Free Beta entitlement catalog.
          </p>
        )}
        {checkoutMessage && <p className="mt-2 text-sm text-ink/60">{checkoutMessage}</p>}
      </section>
      <section className="border border-line bg-white/70 p-6">
        <h3 className="font-head text-lg font-semibold">Usage</h3>
        {usage.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {usage.map((row) => (
              <li key={String(row.metric)} className="flex justify-between border border-line p-3">
                <span>{String(row.metric)}</span>
                <span>
                  {Number(row.used || 0)} / {Number(row.limit || 0)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/50">No usage recorded this period.</p>
        )}
      </section>
    </div>
  );
}
