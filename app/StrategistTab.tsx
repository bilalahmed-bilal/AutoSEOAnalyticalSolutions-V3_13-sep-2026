"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export default function StrategistTab() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    if (!url.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch("/api/strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: url.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Strategist run failed.");
      setData(d);
    } catch (e: unknown) {
      setMessage(errorMessage(e, "Strategist run failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">AI SEO Strategist</h2>
        <p className="mt-1 text-sm text-ink/60">
          AutoSEO ke existing SEO signals ko combine karke next-best actions prioritize karta hai. Strategy run kisi
          website ko automatically change nahi karta.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="min-w-0 flex-1 border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !url.trim()}
            onClick={run}
            className="border-2 border-ink bg-ink px-4 py-2 text-sm text-paper disabled:opacity-40"
          >
            {busy ? "Thinking…" : "Run strategy"}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-clay">{message}</p>}
      </section>
      {data?.plan && (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Priority", data.plan.overallPriority],
              ["Confidence", `${data.plan.confidence}%`],
              ["Actions", data.plan.actions.length],
              ["Signals", data.plan.signals.length],
            ].map(([k, v]) => (
              <div key={String(k)} className="border border-line bg-white/60 p-4 text-center">
                <div className="font-head text-xl">{v}</div>
                <div className="text-[10px] uppercase text-ink/40">{k}</div>
              </div>
            ))}
          </div>
          <div className="border border-signal bg-white/60 p-5">
            <h3 className="font-head font-semibold">Decision summary</h3>
            <p className="mt-2 text-sm text-ink/70">{data.plan.summary}</p>
            {data.aiSummary && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs uppercase text-ink/40">AI explanation</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{data.aiSummary}</p>
              </div>
            )}
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Prioritized actions</h3>
            <div className="mt-3 space-y-3">
              {data.plan.actions.map((a: UnknownRecord) => (
                <div key={a.id} className="border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{a.title}</span>
                      <span className="ml-2 border border-line px-1.5 py-0.5 text-[10px] uppercase text-ink/50">
                        {a.type}
                      </span>
                    </div>
                    <span className="text-xs uppercase text-ink/50">
                      {a.priority} · {a.confidence}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink/70">{a.rationale}</p>
                  <p className="mt-2 text-xs text-ink/60">
                    <b>Expected:</b> {a.expectedOutcome}
                  </p>
                  <p className="mt-2 text-[11px] text-ink/50">
                    Evidence: {a.evidence.join(" · ") || "No direct evidence"}
                  </p>
                  {a.dependencies?.length > 0 && (
                    <p className="mt-1 text-[11px] text-ink/50">Dependencies: {a.dependencies.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          {data.plan.conflicts?.length > 0 && (
            <div className="border border-line bg-white/60 p-5">
              <h3 className="font-head font-semibold">Signal conflicts</h3>
              <div className="mt-2 space-y-2 text-sm text-ink/70">
                {data.plan.conflicts.map((x: string, i: number) => (
                  <p key={i}>• {x}</p>
                ))}
              </div>
            </div>
          )}
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Guardrails</h3>
            <div className="mt-2 space-y-2 text-xs text-ink/60">
              {data.plan.guardrails.map((x: string, i: number) => (
                <p key={i}>• {x}</p>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
