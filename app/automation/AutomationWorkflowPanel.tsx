"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, scheduleMount, type UnknownRecord } from "@/lib/unknown";

const STEP_OPTIONS = [
  ["technical_seo", "Technical SEO"],
  ["site_architecture", "Internal Linking"],
  ["local_seo", "Local SEO"],
  ["competitor_analysis", "Competitor Intelligence"],
  ["keyword_research", "Keyword Research"],
  ["content_strategy", "Content Strategy"],
  ["content_quality", "Content Quality"],
] as const;
export default function AutomationWorkflowPanel() {
  const [workflows, setWorkflows] = useState<UnknownRecord[]>([]);
  const [runs, setRuns] = useState<UnknownRecord[]>([]);
  const [name, setName] = useState("SEO Audit Workflow");
  const [targetUrl, setTargetUrl] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [location, setLocation] = useState("");
  const [keywordProjectId, setKeywordProjectId] = useState("");
  const [seedKeyword, setSeedKeyword] = useState("");
  const [body, setBody] = useState("");
  const [steps, setSteps] = useState<string[]>(["technical_seo", "site_architecture", "competitor_analysis"]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    const [w, r] = await Promise.all([apiFetch("/api/automation/workflows"), apiFetch("/api/automation/runs")]);
    if (w.ok) setWorkflows((await w.json()).workflows || []);
    if (r.ok) setRuns((await r.json()).runs || []);
  }
  useEffect(
    () =>
      scheduleMount(() => {
        void load();
      }),
    []
  );
  function toggle(x: string) {
    setSteps((s) => (s.includes(x) ? s.filter((v) => v !== x) : [...s, x]));
  }
  async function createAndRun() {
    setBusy(true);
    setMessage(null);
    try {
      const wr = await apiFetch("/api/automation/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          triggerType: "manual",
          steps: steps.map((type, i) => ({ id: `${type}-${i + 1}`, type, enabled: true })),
        }),
      });
      const wd = await wr.json();
      if (!wr.ok) throw new Error(wd.error || "Workflow create failed.");
      const rr = await apiFetch("/api/automation/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: wd.workflow.id,
          input: {
            targetUrl,
            competitorUrls: competitors
              .split(/\n|,/)
              .map((x) => x.trim())
              .filter(Boolean),
            location,
            keywordProjectId,
            seedKeyword,
            body,
            maxPages: 25,
          },
        }),
      });
      const rd = await rr.json();
      if (!rr.ok) throw new Error(rd.error || "Run create failed.");
      const er = await apiFetch(`/api/automation/runs/${rd.run.id}/execute`, { method: "POST" });
      const ed = await er.json();
      if (!er.ok) throw new Error(ed.error || "Workflow execution failed.");
      setMessage(
        `Workflow complete: ${ed.results.filter((x: UnknownRecord) => x.status === "succeeded").length}/${ed.results.length} steps successful.`
      );
      await load();
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Automation error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 border border-line bg-white/60 p-6">
      <h2 className="font-head text-lg font-semibold">SEO Automation & Workflows</h2>
      <p className="mt-1 text-sm text-ink/60">
        Run the V23–V30 SEO engines as an ordered workflow. The workflow generates findings; it does not silently modify
        the live website.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Workflow name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Target URL
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 w-full border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Competitor URLs
          <textarea
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="One URL per line"
            className="mt-1 min-h-20 w-full border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Location
          <textarea
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="London, United Kingdom"
            className="mt-1 min-h-20 w-full border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Keyword Project ID
          <input
            value={keywordProjectId}
            onChange={(e) => setKeywordProjectId(e.target.value)}
            className="mt-1 w-full border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Seed keyword
          <input
            value={seedKeyword}
            onChange={(e) => setSeedKeyword(e.target.value)}
            className="mt-1 w-full border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Content body (for Quality step)
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 min-h-24 w-full border border-line bg-white px-3 py-2"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {STEP_OPTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={`border px-3 py-1.5 text-sm ${steps.includes(id) ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={createAndRun}
        disabled={busy || !name.trim() || !steps.length}
        className="mt-4 border-2 border-signal bg-signal px-4 py-2 text-sm font-medium disabled:opacity-40"
      >
        {busy ? "Running…" : "Create & Run Workflow"}
      </button>
      {message && <p className="mt-3 text-xs text-ink/60">{message}</p>}
      {workflows.length > 0 && (
        <div className="mt-6">
          <h3 className="font-head font-semibold">Saved Workflows</h3>
          <div className="mt-2 space-y-2">
            {workflows.slice(0, 8).map((w) => (
              <div key={w.id} className="border border-line bg-white p-3 text-sm">
                <div className="flex justify-between">
                  <span>{w.name}</span>
                  <span className="text-xs uppercase text-ink/50">
                    {w.triggerType} · {w.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/50">{w.steps.map((s: UnknownRecord) => s.type).join(" → ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {runs.length > 0 && (
        <div className="mt-6">
          <h3 className="font-head font-semibold">Recent Runs</h3>
          <div className="mt-2 space-y-2">
            {runs.slice(0, 8).map((r) => (
              <div key={r.id} className="border border-line bg-white p-3 text-xs">
                <div className="flex justify-between">
                  <span>{r.id.slice(0, 8)}…</span>
                  <span className="uppercase">{r.status}</span>
                </div>
                {r.error && <p className="mt-1 text-clay">{r.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
