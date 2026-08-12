"use client";

import { useState } from "react";
import { signIn, signUp } from "@/lib/store";

/**
 * Email and password. Shared by the landing page and the deep-link sign-in
 * screen so the two can't drift apart.
 *
 * On success nothing is reported here — the auth listener in the store reloads
 * the data and the page swaps itself out.
 */
export default function SignInForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = email.trim() !== "" && password !== "";

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setStatus(null);
    const result = creating
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password);
    setStatus(result);
    setBusy(false);
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2">
        <input
          type="email"
          autoComplete="email"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
        />
        <input
          type="password"
          // Tells a password manager whether to offer a saved password or a new one.
          autoComplete={creating ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={!ready || busy}
          className="rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:opacity-40"
        >
          {busy ? "…" : creating ? "Create account" : "Sign in"}
        </button>
      </div>

      <button
        onClick={() => {
          setCreating(!creating);
          setStatus(null);
        }}
        className="mt-3 text-xs text-muted underline underline-offset-4 hover:text-foreground"
      >
        {creating ? "Already have an account? Sign in" : "No account yet? Create one"}
      </button>

      {status && <p className="mt-3 text-sm text-incorrect">{status}</p>}
    </div>
  );
}
