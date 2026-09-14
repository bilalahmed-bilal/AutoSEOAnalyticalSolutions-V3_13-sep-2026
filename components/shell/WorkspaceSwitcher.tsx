"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export default function WorkspaceSwitcher({ compact = true }: { compact?: boolean }) {
  const [workspaces, setWorkspaces] = useState<UnknownRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch("/api/workspaces");
    if (!res.ok) return;
    const data = await res.json();
    const list = data.workspaces || [];
    setWorkspaces(list);
    const saved = window.localStorage.getItem("autoseo.workspaceId");
    const next = list.some((w: UnknownRecord) => w.id === saved) ? saved! : list[0]?.id || "";
    setSelected(next);
    if (next) window.localStorage.setItem("autoseo.workspaceId", next);
  }

  useEffect(
    () =>
      scheduleMount(() => {
        void load().catch(() => undefined);
      }),
    []
  );

  async function createWorkspace() {
    if (!name.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the workspace.");
      window.localStorage.setItem("autoseo.workspaceId", data.workspace.id);
      setName("");
      setMessage("Workspace created.");
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Workspace error."));
    } finally {
      setBusy(false);
    }
  }

  const empty = !workspaces.length;
  const wrapClass = compact ? "flex min-w-0 flex-wrap items-center gap-2" : "mt-2 flex flex-wrap items-center gap-2";
  const createControls = (
    <>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Workspace name"
        aria-label="Workspace name"
        className="min-h-9 w-[10.5rem] py-1.5"
      />
      <Button variant="primary" size="sm" onClick={createWorkspace} disabled={busy || !name.trim()}>
        {busy ? "Creating…" : empty ? "Create workspace" : "Create"}
      </Button>
    </>
  );

  if (empty) {
    return (
      <div className={wrapClass}>
        <span className="text-xs text-muted">Create your first workspace</span>
        {createControls}
        {message ? <span className="text-xs text-muted">{message}</span> : null}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <label className="sr-only" htmlFor="nx-workspace">
        Workspace
      </label>
      <select
        id="nx-workspace"
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          window.localStorage.setItem("autoseo.workspaceId", e.target.value);
          window.location.reload();
        }}
        className="min-h-9 max-w-[14rem] truncate rounded-[var(--nx-radius-sm)] border border-line bg-elevated px-2.5 py-1.5 text-sm text-ink"
      >
        {workspaces.map((w) => (
          <option key={String(w.id)} value={String(w.id)}>
            {String(w.name)} · {String(w.role)}
          </option>
        ))}
      </select>
      {createControls}
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </div>
  );
}
