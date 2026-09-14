"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export default function OperatingSystemTab() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const r = await apiFetch("/api/os/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Operating cycle failed");
      setData(d);
    } catch (e: unknown) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="border border-line bg-white/60 p-6">
        <h2 className="font-head text-lg font-semibold">AIBISORA AI Operating System</h2>
        <p className="mt-2 text-sm text-ink/60">
          V35 combines existing SEO intelligence, monitoring, and strategy into a single operating cycle. This system
          coordinates recommendations — it does not take destructive or publishing actions on its own.
        </p>
        <div className="mt-4 flex gap-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="min-w-0 flex-1 border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            disabled={!url.trim() || busy}
            onClick={run}
            className="border-2 border-ink bg-ink px-4 py-2 text-sm text-paper disabled:opacity-40"
          >
            {busy ? "Running…" : "Run operating cycle"}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-clay">{message}</p>}
      </section>
      {data?.cycle && (
        <section className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-line bg-white/60 p-4 text-center">
              <div className="font-head text-2xl">{data.cycle.score}</div>
              <div className="text-[10px] uppercase text-ink/40">Operating score</div>
            </div>
            <div className="border border-line bg-white/60 p-4 text-center">
              <div className="font-head text-2xl">{data.cycle.status}</div>
              <div className="text-[10px] uppercase text-ink/40">Status</div>
            </div>
            <div className="border border-line bg-white/60 p-4 text-center">
              <div className="font-head text-2xl">{data.cycle.priorities.length}</div>
              <div className="text-[10px] uppercase text-ink/40">Priorities</div>
            </div>
          </div>
          <div className="border border-signal bg-white/60 p-5">
            <h3 className="font-head font-semibold">Operating decision</h3>
            <p className="mt-2 text-sm text-ink/70">{data.cycle.summary}</p>
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Next-best actions</h3>
            <div className="mt-3 space-y-3">
              {data.cycle.priorities.map((x: UnknownRecord) => (
                <div key={x.id} className="border border-line bg-white p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium">{x.title}</p>
                      <p className="mt-1 text-xs text-ink/50">
                        {x.owner} · {x.priority}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink/70">{x.reason}</p>
                  <p className="mt-2 text-xs text-ink/50">
                    <b>Next:</b> {x.nextStep}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-line bg-white/60 p-5">
            <h3 className="font-head font-semibold">Operating controls</h3>
            {data.cycle.controls.map((x: string, i: number) => (
              <p key={i} className="mt-2 text-xs text-ink/60">
                • {x}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
