"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { adoptRecoveryTokens, updatePassword } from "@/lib/auth/browser";
import { errorMessage } from "@/lib/unknown";
import ThemeToggle from "@/app/theme/ThemeToggle";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";

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
      adoptRecoveryTokens(access, refresh, expires ? Number(expires) : undefined).catch(() => {
        localStorage.setItem(
          "autoseo.supabase.session",
          JSON.stringify({
            access_token: access,
            refresh_token: refresh,
            expires_at: expires ? Number(expires) : undefined,
          })
        );
        window.dispatchEvent(new Event("autoseo-auth-change"));
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await updatePassword(password);
      setMsg("Password updated. You can return to AIBISORA.");
    } catch (e: unknown) {
      setErr(errorMessage(e, "Password could not be updated."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-bg p-6 pt-16">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="mx-auto max-w-md">
        <PageHeader title="Set new password" description="Use the recovery link to set a new password." />
        <div className="flex overflow-hidden rounded-[var(--nx-radius-sm)] border border-[var(--nx-border-strong)] bg-elevated">
          <input
            required
            minLength={6}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-10 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            placeholder="New password"
            aria-label="New password"
          />
          <button type="button" onClick={() => setShow(!show)} className="px-3 text-xs text-muted">
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <Button
          variant="primary"
          className="mt-4 w-full"
          disabled={busy || password.length < 6}
          loading={busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Update password"}
        </Button>
        {err && <Alert className="mt-3">{err}</Alert>}
        {msg && (
          <Alert tone="success" className="mt-3">
            {msg}
          </Alert>
        )}
        <Link href="/" className="mt-5 block text-sm text-primary underline-offset-2 hover:underline">
          Back to AIBISORA
        </Link>
      </Card>
    </main>
  );
}
