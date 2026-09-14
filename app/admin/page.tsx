"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import { productBrand } from "@/lib/product/brand";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";
import ThemeToggle from "@/app/theme/ThemeToggle";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";

type AdminSection = "overview" | "users" | "workspaces" | "features" | "usage" | "connections" | "audit" | "settings";

const SECTIONS: { id: AdminSection; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "workspaces", label: "Workspaces" },
  { id: "features", label: "Features" },
  { id: "usage", label: "Usage" },
  { id: "connections", label: "Connections" },
  { id: "audit", label: "Audit logs" },
  { id: "settings", label: "System settings" },
];

export default function AdminConsolePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [section, setSection] = useState<AdminSection>("overview");
  const [overview, setOverview] = useState<UnknownRecord | null>(null);
  const [workspaces, setWorkspaces] = useState<UnknownRecord[]>([]);
  const [logs, setLogs] = useState<UnknownRecord[]>([]);
  const [users, setUsers] = useState<UnknownRecord[]>([]);
  const [usage, setUsage] = useState<UnknownRecord[]>([]);
  const [connections, setConnections] = useState<UnknownRecord[]>([]);
  const [settings, setSettings] = useState<UnknownRecord | null>(null);
  const [error, setError] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [planSlug, setPlanSlug] = useState("free");
  const [featureKey, setFeatureKey] = useState("youtube.analytics");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/session").then(async (res) => {
      setAllowed(res.ok);
      if (!res.ok) return;
      const [o, w, a, u, usageRes, c, s] = await Promise.all([
        apiFetch("/api/admin/overview"),
        apiFetch("/api/admin/workspaces"),
        apiFetch("/api/admin/audit"),
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/usage"),
        apiFetch("/api/admin/connections"),
        apiFetch("/api/admin/settings"),
      ]);
      if (o.ok) setOverview(await o.json());
      if (w.ok) setWorkspaces((await w.json()).workspaces || []);
      if (a.ok) setLogs((await a.json()).logs || []);
      if (u.ok) setUsers((await u.json()).members || []);
      if (usageRes.ok) setUsage((await usageRes.json()).counters || []);
      if (c.ok) setConnections((await c.json()).connections || []);
      if (s.ok) setSettings(await s.json());
    });
  }, []);

  if (allowed === null)
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8 text-sm text-muted">
        Checking admin access…
      </main>
    );
  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-8 text-center">
        <h1 className="nx-page-title">Access denied</h1>
        <p className="mt-2 text-sm text-[var(--nx-text-secondary)]">
          This AIBISORA Admin Console is limited to platform administrators.
        </p>
        <Link href="/" className="mt-4 text-sm text-primary underline-offset-2 hover:underline">
          Back to {productBrand.productName}
        </Link>
      </main>
    );
  }

  async function assignPlan() {
    setMessage("");
    setError("");
    const res = await apiFetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, planSlug, status: "trial" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Plan update failed.");
    else setMessage("Plan assigned. Free Beta still gates features from the beta catalog until billing is enabled.");
  }

  async function grantFeature() {
    setMessage("");
    setError("");
    const res = await apiFetch("/api/admin/entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, featureKey, effect: "grant" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Override failed.");
    else setMessage("Entitlement override saved.");
  }

  async function suspend(id: string, action: "suspend" | "restore") {
    setError("");
    const res = await apiFetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id, action }),
    });
    const data = await res.json();
    if (!res.ok) setError(errorMessage(data.error, "Workspace update failed."));
    else {
      setWorkspaces((current) =>
        current.map((row) => (row.id === id ? { ...row, status: action === "suspend" ? "suspended" : "active" } : row))
      );
    }
  }

  return (
    <main className="min-h-screen bg-bg" data-app>
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-surface p-4 md:block">
          <p className="nx-label">Admin</p>
          <p className="mt-1 text-sm font-semibold">{productBrand.productName}</p>
          <nav className="mt-6 space-y-1" aria-label="Admin sections">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                className={`focus-ring flex min-h-10 w-full items-center rounded-[10px] px-3 text-left text-sm ${
                  section === item.id
                    ? "bg-[color-mix(in_srgb,var(--nx-primary)_12%,transparent)] text-ink"
                    : "text-[var(--nx-text-secondary)] hover:text-ink"
                }`}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex min-h-[var(--nx-header)] items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
            <div>
              <p className="nx-label">Control plane</p>
              <h1 className="text-sm font-semibold">Free Beta · billing OFF · tokens never shown</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/" className="text-sm text-primary underline-offset-2 hover:underline">
                Back to app
              </Link>
            </div>
          </header>
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
            <nav className="flex flex-wrap gap-2 md:hidden" aria-label="Admin sections">
              {SECTIONS.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={section === item.id ? "primary" : "secondary"}
                  onClick={() => setSection(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
            {error && <Alert>{error}</Alert>}
            {message && <Alert tone="success">{message}</Alert>}

            {section === "overview" && (
              <section className="grid gap-3 sm:grid-cols-3">
                {overview &&
                  [
                    ["Workspaces", overview.workspaces],
                    ["Trials", overview.trialWorkspaces],
                    ["Paid", overview.paidWorkspaces],
                    ["Failed jobs", overview.failedJobs],
                    ["Connections", overview.connectedAccounts],
                    ["Suspended", overview.suspendedWorkspaces],
                  ].map(([label, value]) => (
                    <MetricCard key={String(label)} label={String(label)} value={value ?? 0} />
                  ))}
              </section>
            )}

            {section === "features" && (
              <Card>
                <h2 className="nx-section-title">Assign plan / entitlement</h2>
                <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">
                  During Free Beta, feature access follows the beta catalog. Overrides and suspension still apply.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    className="min-h-11 w-56"
                    placeholder="Workspace UUID"
                    value={workspaceId}
                    onChange={(e) => setWorkspaceId(e.target.value)}
                    aria-label="Workspace UUID"
                  />
                  <Select
                    className="min-h-11 w-40"
                    value={planSlug}
                    onChange={(e) => setPlanSlug(e.target.value)}
                    aria-label="Plan"
                  >
                    {["free", "starter", "pro", "pro-plus", "business", "custom"].map((slug) => (
                      <option key={slug}>{slug}</option>
                    ))}
                  </Select>
                  <Button onClick={assignPlan}>Assign plan</Button>
                  <Input
                    className="min-h-11 w-52"
                    value={featureKey}
                    onChange={(e) => setFeatureKey(e.target.value)}
                    aria-label="Feature key"
                  />
                  <Button onClick={grantFeature}>Grant feature</Button>
                </div>
              </Card>
            )}

            {section === "workspaces" && (
              <section className="border border-line p-4">
                <h2 className="font-head text-lg">Workspaces</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-ink/50">
                        <th className="py-2">Name</th>
                        <th>Status</th>
                        <th>ID</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaces.map((row) => (
                        <tr key={String(row.id)} className="border-t">
                          <td className="py-2">{String(row.name)}</td>
                          <td>{String(row.status || "active")}</td>
                          <td className="font-mono text-xs">{String(row.id)}</td>
                          <td>
                            <button
                              className="mr-2 min-h-11 underline"
                              onClick={() =>
                                suspend(String(row.id), row.status === "suspended" ? "restore" : "suspend")
                              }
                            >
                              {row.status === "suspended" ? "Restore" : "Suspend"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === "users" && (
              <section className="border border-line p-4">
                <h2 className="font-head text-lg">Users</h2>
                <p className="mt-1 text-sm text-ink/60">
                  Membership records only. Auth emails are not listed unless stored on platform_admins.
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-ink/50">
                        <th className="py-2">User ID</th>
                        <th>Role</th>
                        <th>Workspace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((row, index) => (
                        <tr key={`${row.user_id}-${row.workspace_id}-${index}`} className="border-t">
                          <td className="py-2 font-mono text-xs">{String(row.user_id)}</td>
                          <td>{String(row.role)}</td>
                          <td className="font-mono text-xs">{String(row.workspace_id)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === "usage" && (
              <section className="border border-line p-4">
                <h2 className="font-head text-lg">Usage</h2>
                {!usage.length && <p className="mt-2 text-sm text-ink/50">No usage counters yet.</p>}
                <ul className="mt-3 space-y-2 text-sm">
                  {usage.map((row, index) => (
                    <li key={`${row.workspace_id}-${row.metric}-${index}`} className="border p-2">
                      {String(row.workspace_id)} · {String(row.metric)} · {String(row.quantity)} / {String(row.period)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {section === "connections" && (
              <section className="border border-line p-4">
                <h2 className="font-head text-lg">Connections</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-ink/50">
                        <th className="py-2">Provider</th>
                        <th>Status</th>
                        <th>Workspace</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connections.map((row) => (
                        <tr key={String(row.id)} className="border-t">
                          <td className="py-2">{String(row.provider)}</td>
                          <td>{String(row.status)}</td>
                          <td className="font-mono text-xs">{String(row.workspaceId)}</td>
                          <td>{row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === "audit" && (
              <section className="border border-line p-4">
                <h2 className="font-head text-lg">Audit logs</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {logs.map((row) => (
                    <li key={String(row.id)} className="border p-2">
                      {String(row.created_at)} · {String(row.action)} · {String(row.entity_type || "")}
                    </li>
                  ))}
                  {!logs.length && <li className="text-ink/50">No audit events yet.</li>}
                </ul>
              </section>
            )}

            {section === "settings" && (
              <section className="border border-line p-4">
                <h2 className="font-head text-lg">System settings</h2>
                {settings ? (
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="border p-3">
                      <dt className="text-xs uppercase text-ink/50">Beta</dt>
                      <dd>{String(settings.beta)}</dd>
                    </div>
                    <div className="border p-3">
                      <dt className="text-xs uppercase text-ink/50">Billing</dt>
                      <dd>{String(settings.billing)}</dd>
                    </div>
                    <div className="border p-3">
                      <dt className="text-xs uppercase text-ink/50">Rate limit</dt>
                      <dd>{String(settings.rateLimitBackend)}</dd>
                    </div>
                    <div className="border p-3">
                      <dt className="text-xs uppercase text-ink/50">Facebook pages</dt>
                      <dd>{String(settings.facebookPageSelection)}</dd>
                    </div>
                    <div className="border p-3">
                      <dt className="text-xs uppercase text-ink/50">Default language</dt>
                      <dd>{String(settings.languages?.default || "en")}</dd>
                    </div>
                    <div className="border p-3">
                      <dt className="text-xs uppercase text-ink/50">Enabled languages</dt>
                      <dd>
                        {Array.isArray(settings.languages?.enabled) ? settings.languages.enabled.join(", ") : "en"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-ink/50">Settings unavailable.</p>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
