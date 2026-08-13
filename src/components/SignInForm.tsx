"use client";

import { useId, useState } from "react";
import { signIn, signUp, type AuthResult } from "@/lib/store";

/**
 * A real <form> with real labels.
 *
 * Both matter more than they look: password managers key off form semantics and
 * autocomplete hints to offer the right credential, and a login box with no
 * labels — just grey placeholders that vanish as you type — is what phishing
 * pages look like. Getting this wrong makes an honest app feel untrustworthy.
 */
export default function SignInForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const emailId = useId();
  const passwordId = useId();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = email.trim() !== "" && password !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setResult(null);
    setResult(
      creating ? await signUp(email.trim(), password) : await signIn(email.trim(), password),
    );
    setBusy(false);
  }

  function switchMode(next: boolean) {
    setCreating(next);
    setResult(null);
  }

  const tab = "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors";

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-6 shadow-lg">
      <div className="flex gap-1 rounded-lg bg-background p-1">
        <button
          type="button"
          onClick={() => switchMode(false)}
          className={`${tab} ${creating ? "text-muted hover:text-foreground" : "bg-surface shadow-sm"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode(true)}
          className={`${tab} ${creating ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={submit} className="mt-5">
        <label htmlFor={emailId} className="block text-xs font-semibold text-muted">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          autoFocus={autoFocus}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 outline-none transition-colors focus:border-primary"
        />

        <label
          htmlFor={passwordId}
          className="mt-4 block text-xs font-semibold text-muted"
        >
          Password
          {creating && <span className="font-normal"> · at least 6 characters</span>}
        </label>
        <div className="relative mt-1.5">
          <input
            id={passwordId}
            name="password"
            type={reveal ? "text" : "password"}
            autoComplete={creating ? "new-password" : "current-password"}
            required
            minLength={creating ? 6 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-border bg-background py-2.5 pr-16 pl-4 outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setReveal(!reveal)}
            // Typos in a masked field are the usual reason a correct password
            // "fails", and there's nobody to shoulder-surf a personal tool.
            className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-muted hover:text-foreground"
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>

        {result?.message && (
          <p
            role="alert"
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              result.ok ? "bg-correct/10 text-correct" : "bg-incorrect/10 text-incorrect"
            }`}
          >
            {result.message}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || busy}
          className="mt-5 w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "One moment…" : creating ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
