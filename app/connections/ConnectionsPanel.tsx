"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";

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
    <section className="border border-line bg-white p-6">
      <h2 className="font-head text-lg font-semibold">Connections</h2>
      <p className="mt-1 text-sm text-ink/60">
        Tokens are never shown. Facebook connects the first Page only (FIRST_PAGE_ONLY). Use Publish to connect, then
        reconnect or revoke from here.
      </p>
      {error && <p className="mt-3 border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-3 text-sm text-ink/70">{message}</p>}
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-ink/50">
                <th className="py-2">Provider</th>
                <th>Status</th>
                <th>Last check</th>
                <th>Last error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} className="border-b border-line/70">
                  <td className="py-3">{String(row.provider)}</td>
                  <td>{String(row.status)}</td>
                  <td>{row.lastCheckedAt ? new Date(String(row.lastCheckedAt)).toLocaleString() : "—"}</td>
                  <td className="max-w-[16rem] truncate">{row.lastError ? String(row.lastError) : "—"}</td>
                  <td>
                    <button
                      className="border border-ink px-2 py-1 text-xs disabled:opacity-50"
                      disabled={busy === row.id || row.status === "revoked"}
                      onClick={() => revoke(String(row.id))}
                    >
                      {busy === row.id ? "…" : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink/50">No connections in this workspace.</p>
      )}
    </section>
  );
}
