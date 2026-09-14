"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";
import { Alert, Badge, EmptyState } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard, PageHeader } from "@/components/ui/Card";

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
    <div className="space-y-6">
      <PageHeader
        title="Subscription & usage"
        description="AIBISORA Free Beta — billing and paid checkout are OFF. Feature access comes from the beta entitlement catalog."
        actions={<Badge tone="warning">Payments off</Badge>}
      />
      {error && <Alert>{error}</Alert>}
      <Card>
        {subscription ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Plan" value={String(subscription.name)} hint={String(subscription.status)} />
            <MetricCard
              label="Trial"
              value={
                subscription.trialEndsAt
                  ? new Date(String(subscription.trialEndsAt)).toLocaleDateString()
                  : "Not scheduled"
              }
            />
            <MetricCard
              label="Billing"
              value={subscription.beta ? "Free Beta" : String(subscription.billing || "OFF")}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">No subscription loaded.</p>
        )}
        {subscription?.catalogOnly ? (
          <p className="mt-4 text-sm text-[var(--nx-text-secondary)]">
            Catalog-only mode: apply `supabase/v46-nexora-saas.sql` to persist subscriptions.
          </p>
        ) : null}
        {subscription?.billing && subscription.billing !== "OFF" && !subscription.beta ? (
          <Button variant="primary" className="mt-4" onClick={checkout}>
            Upgrade via billing provider
          </Button>
        ) : (
          <p className="mt-4 rounded-[var(--nx-radius-sm)] border border-line bg-elevated p-3 text-sm text-[var(--nx-text-secondary)]">
            Payments are disabled for this beta. No fake payment success or invented subscription is shown.
          </p>
        )}
        {checkoutMessage && <p className="mt-2 text-sm text-muted">{checkoutMessage}</p>}
      </Card>
      <Card>
        <h3 className="nx-card-title text-ink">Usage</h3>
        {usage.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {usage.map((row) => {
              const used = Number(row.used || 0);
              const limit = Number(row.limit || 0);
              const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              return (
                <li key={String(row.metric)} className="rounded-[10px] border border-line p-3">
                  <div className="flex justify-between gap-3">
                    <span>{String(row.metric)}</span>
                    <span className="text-[var(--nx-text-secondary)]">
                      {used} / {limit}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--nx-text)_8%,transparent)]">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No usage recorded this period"
            description="Usage appears after AI, SEO, or publishing work runs in this workspace."
          />
        )}
      </Card>
    </div>
  );
}
