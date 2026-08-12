"use client";

import { useState } from "react";
import { signIn } from "@/lib/store";

/**
 * Magic-link sign-in. No password to store, lose, or leak — Supabase emails a
 * link and the session persists afterwards, so this screen is a rare sight.
 */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!email.trim() || sending) return;
    setSending(true);
    setStatus(await signIn(email.trim()));
    setSending(false);
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-4 py-20">
      <h1 className="jp text-3xl font-bold tracking-tight">ピクニク</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in to reach your cards. We&rsquo;ll email you a link — no password.
      </p>

      <input
        type="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="you@example.com"
        className="mt-6 w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-primary"
      />
      <button
        onClick={submit}
        disabled={!email.trim() || sending}
        className="mt-3 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
      >
        {sending ? "Sending…" : "Email me a link"}
      </button>

      {status && <p className="mt-4 text-center text-sm text-muted">{status}</p>}
    </main>
  );
}
