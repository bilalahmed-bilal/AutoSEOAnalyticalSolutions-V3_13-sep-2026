"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";
import { Alert, ApprovalBadge, EmptyState } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";

export default function ConnectionsPanel() {
  const [rows, setRows] = useState<UnknownRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch("/api/connections");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Connections load failed.");
    setRows(data.connections || []);
  }

  useEffect(
    () =>
      scheduleMount(() => {
        load().catch((err: unknown) => setError(errorMessage(err, "Connections load failed.")));
      }),
    []
  );

  async function revoke(id: string) {
    if (!window.confirm("Disconnect and revoke this connection?")) return;
    setBusy(id);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/connections/${id}/revoke`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke failed.");
      setMessage(data.message || "Disconnected.");
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Revoke failed."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Connections"
        description="Tokens are never shown. Facebook connects the first Page only (FIRST_PAGE_ONLY). Use Publishing to connect, then reconnect or revoke from here."
      />
      {error && <Alert className="mb-4">{error}</Alert>}
      {message && (
        <Alert tone="success" className="mb-4">
          {message}
        </Alert>
      )}
      {rows.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3">Provider</th>
                  <th>Status</th>
                  <th>Last check</th>
                  <th>Last error</th>
                  <th className="px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 capitalize">{String(row.provider).replace(/-/g, " ")}</td>
                    <td>
                      <ApprovalBadge status={String(row.status)} />
                    </td>
                    <td className="text-[var(--nx-text-secondary)]">
                      {row.lastCheckedAt ? new Date(String(row.lastCheckedAt)).toLocaleString() : "—"}
                    </td>
                    <td className="max-w-[16rem] truncate text-[var(--nx-text-secondary)]">
                      {row.lastError ? String(row.lastError) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy === row.id || row.status === "revoked"}
                        onClick={() => revoke(String(row.id))}
                      >
                        {busy === row.id ? "…" : "Disconnect"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No connections in this workspace"
          description="Connect Search Console, YouTube, or Facebook from Publishing. AIBISORA will show account identity and status here without exposing secrets."
        />
      )}
    </div>
  );
}
