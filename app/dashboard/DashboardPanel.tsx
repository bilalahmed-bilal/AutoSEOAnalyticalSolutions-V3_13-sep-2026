"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";

export default function DashboardPanel() {
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      scheduleMount(() => {
        apiFetch("/api/dashboard")
          .then(async (res) => {
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Dashboard load failed.");
            setData(json);
          })
          .catch((err: unknown) => setError(errorMessage(err, "Dashboard load failed.")))
          .finally(() => setLoading(false));
      }),
    []
  );

  if (loading) return <p className="text-sm text-ink/60">Loading dashboard…</p>;
  if (error) return <p className="border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!data || data.empty) {
    return (
      <section className="border border-line bg-white p-6">
        <h2 className="font-head text-lg font-semibold">Dashboard</h2>
        <p className="mt-2 text-sm text-ink/60">
          {String(
            data?.message ||
              "Connect a workspace to see live SEO, publishing, and usage metrics. Nexora does not invent sample numbers."
          )}
        </p>
      </section>
    );
  }

  const seo = data.seoHealth as UnknownRecord | null;
  const connected = (data.connectedAccounts as UnknownRecord[]) || [];
  const drafts = (data.recentContent as UnknownRecord[]) || [];
  const automation = (data.automationStatus as UnknownRecord) || {};
  const subscription = (data.subscription as UnknownRecord) || {};

  return (
    <div className="space-y-4">
      <section className="border-2 border-ink bg-white p-6">
        <h2 className="font-head text-xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-sm text-ink/60">Live workspace values only. Empty cards mean no data exists yet.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="SEO score" value={seo?.score ?? "No audits yet"} />
          <Metric label="Pending approvals" value={data.pendingApprovals ?? 0} />
          <Metric label="Queued jobs" value={data.scheduledActions ?? 0} />
          <Metric label="Plan" value={`${subscription.name || "Unknown"} (${subscription.status || "n/a"})`} />
        </div>
      </section>
      <section className="border border-line bg-white/70 p-6">
        <h3 className="font-head text-lg font-semibold">Connected accounts</h3>
        {connected.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {connected.map((row) => (
              <li key={String(row.id)} className="flex justify-between border border-line p-3">
                <span>{String(row.provider)}</span>
                <span>{String(row.status)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/50">No connections yet.</p>
        )}
      </section>
      <section className="border border-line bg-white/70 p-6">
        <h3 className="font-head text-lg font-semibold">Automation</h3>
        <p className="mt-2 text-sm">
          Queued {Number(automation.queued || 0)} · Running {Number(automation.running || 0)} · Failed{" "}
          {Number(automation.failed || 0)}
        </p>
      </section>
      <section className="border border-line bg-white/70 p-6">
        <h3 className="font-head text-lg font-semibold">Recent content</h3>
        {drafts.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {drafts.map((row) => (
              <li key={String(row.id)} className="border border-line p-3">
                {String(row.title || row.channel)} · {String(row.status)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/50">No drafts yet.</p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="border border-line bg-paper p-4">
      <p className="text-xs uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 font-head text-lg">{String(value)}</p>
    </div>
  );
}
