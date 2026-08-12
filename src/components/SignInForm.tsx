"use client";

import { useState } from "react";
import { signIn } from "@/lib/store";

/**
 * Just the form. Shared by the full-page sign-in and the landing page, so the
 * two can't drift apart.
 */
export default function SignInForm({ autoFocus = false }: { autoFocus?: boolean }) {
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
    <div className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="you@example.com"
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={!email.trim() || sending}
          className="rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:opacity-40"
        >
          {sending ? "Sending…" : "Email me a link"}
        </button>
      </div>
      {status && <p className="mt-3 text-sm text-muted">{status}</p>}
    </div>
  );
}
