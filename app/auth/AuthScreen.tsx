"use client";
import { FormEvent, useState } from "react";
import { resetPassword, signIn, signUp } from "@/lib/auth/browser";
import { errorMessage } from "@/lib/unknown";
import { useUiLanguage } from "@/app/i18n/LanguageProvider";
import ThemeToggle from "@/app/theme/ThemeToggle";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { productBrand } from "@/lib/product/brand";

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { t } = useUiLanguage();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        await resetPassword(email.trim());
        setMessage("Password reset email sent. Check inbox and spam.");
      } else if (mode === "signup") {
        const data = await signUp(email.trim(), password);
        setMessage(
          data.access_token || data.sessionEstablished
            ? "Account created."
            : "Account created. Confirm your email, then sign in."
        );
        if (data.access_token || data.sessionEstablished) onAuthenticated();
      } else {
        await signIn(email.trim(), password);
        onAuthenticated();
      }
    } catch (err: unknown) {
      setError(errorMessage(err, t("errors.requestFailed")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-[var(--nx-radius-lg)] border border-line bg-surface shadow-[var(--nx-shadow-medium)] lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="hidden flex-col justify-between bg-[color-mix(in_srgb,var(--nx-inverse)_92%,var(--nx-primary))] p-8 text-[var(--nx-on-inverse)] lg:flex">
        <div>
          <p className="nx-label text-[var(--nx-on-inverse)]/70">Free Beta</p>
          <h1 className="nx-display mt-3">{productBrand.productName}</h1>
          <p className="mt-3 max-w-sm text-sm text-[var(--nx-on-inverse)]/75">{productBrand.tagline}</p>
        </div>
        <p className="text-xs text-[var(--nx-on-inverse)]/60">
          Discover, analyze, recommend, create, approve, and measure — humans stay in control of publishing.
        </p>
      </aside>
      <section className="relative p-6 sm:p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <p className="nx-label lg:hidden">{productBrand.productName}</p>
        <h2 className="nx-page-title mt-2 text-ink">
          {mode === "login" ? t("auth.login") : mode === "signup" ? t("auth.signup") : t("auth.reset")}
        </h2>
        <p className="mt-2 text-sm text-[var(--nx-text-secondary)]">Secure access to your AIBISORA workspace.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm" htmlFor="auth-email">
            {t("auth.email")}
            <Input
              id="auth-email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </label>
          {mode !== "forgot" && (
            <label className="block text-sm" htmlFor="auth-password">
              {t("auth.password")}
              <div className="mt-1 flex overflow-hidden rounded-[var(--nx-radius-sm)] border border-[var(--nx-border-strong)] bg-elevated">
                <input
                  id="auth-password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-10 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                />
                <button type="button" onClick={() => setShow(!show)} className="px-3 text-xs text-muted">
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}
          {error && <Alert>{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}
          <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? t("auth.login")
                : mode === "signup"
                  ? t("auth.signup")
                  : "Send reset email"}
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setMessage("");
            }}
            className="text-primary underline-offset-2 hover:underline"
          >
            {mode === "login" ? t("auth.signup") : "Back to sign in"}
          </button>
          {mode !== "forgot" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-muted underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
