"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { updatePassword } from "@/lib/auth/browser";
import { errorMessage } from "@/lib/unknown";

export default function ResetPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access = hash.get("access_token"),
      refresh = hash.get("refresh_token"),
      expires = hash.get("expires_at");
    if (access && refresh) {
      localStorage.setItem(
        "autoseo.supabase.session",
        JSON.stringify({
          access_token: access,
          refresh_token: refresh,
          expires_at: expires ? Number(expires) : undefined,
        })
      );
      window.dispatchEvent(new Event("autoseo-auth-change"));
    }
  }, []);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await updatePassword(password);
      setMsg("Password update ho gaya. Ab AutoSEO par wapas ja sakte hain.");
    } catch (e: unknown) {
      setErr(errorMessage(e, "Password update nahi ho saka."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-paper p-6 pt-20">
      <section className="mx-auto max-w-md border border-line bg-white p-6">
        <h1 className="font-head text-2xl font-semibold">Set new password</h1>
        <p className="mt-2 text-sm text-ink/60">Recovery link se apna new password set karein.</p>
        <div className="mt-5 flex border border-line">
          <input
            required
            minLength={6}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 px-3 py-2"
            placeholder="New password"
          />
          <button type="button" onClick={() => setShow(!show)} className="px-3 text-xs">
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <button
          disabled={busy || password.length < 6}
          onClick={save}
          className="mt-4 w-full bg-ink px-4 py-2 text-paper disabled:opacity-40"
        >
          {busy ? "Saving…" : "Update password"}
        </button>
        {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
        <Link href="/" className="mt-5 block text-sm underline">
          Back to AutoSEO
        </Link>
      </section>
    </main>
  );
}
