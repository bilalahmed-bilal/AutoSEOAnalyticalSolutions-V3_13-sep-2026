"use client";
import { FormEvent, useEffect, useState } from "react";
import { resetPassword, signIn, signUp } from "@/lib/auth/browser";

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); setMessage(""); try {
    if (mode === "forgot") { await resetPassword(email.trim()); setMessage("Password reset email bhej di gayi hai. Inbox aur spam folder check karein."); }
    else if (mode === "signup") { const data = await signUp(email.trim(), password); setMessage(data.access_token ? "Account create ho gaya." : "Account create ho gaya. Email confirmation ke baad login karein."); if (data.access_token) onAuthenticated(); }
    else { await signIn(email.trim(), password); onAuthenticated(); }
  } catch (err: any) { setError(err.message || "Request failed."); } finally { setBusy(false); } }
  return <section className="mx-auto max-w-md border border-line bg-white/80 p-6 shadow-sm">
    <p className="text-xs uppercase tracking-[.2em] text-signal">AutoSEO</p><h1 className="mt-2 font-head text-2xl font-semibold text-ink">{mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}</h1>
    <p className="mt-2 text-sm text-ink/60">Apne AutoSEO workspace mein secure access karein.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm">Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border border-line bg-white px-3 py-2" /></label>
      {mode !== "forgot" && <label className="block text-sm">Password<div className="mt-1 flex border border-line bg-white"><input required minLength={6} type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} className="min-w-0 flex-1 px-3 py-2 outline-none" /><button type="button" onClick={()=>setShow(!show)} className="px-3 text-xs text-ink/60">{show?"Hide":"Show"}</button></div></label>}
      {error && <p className="border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>}{message && <p className="border border-green-300 bg-green-50 p-2 text-sm text-green-700">{message}</p>}
      <button disabled={busy} className="w-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{busy?"Please wait…":mode === "login"?"Sign in":mode === "signup"?"Create account":"Send reset email"}</button>
    </form>
    <div className="mt-5 flex flex-wrap gap-3 text-xs"><button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setMessage("")}} className="underline">{mode==="login"?"Create account":"Back to sign in"}</button>{mode!=="forgot"&&<button onClick={()=>setMode("forgot")} className="underline">Forgot password?</button>}</div>
  </section>;
}
