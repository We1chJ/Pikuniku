"use client";

import Link from "next/link";
import SignInForm from "./SignInForm";

/**
 * Full-page sign-in, shown when a deep link (a card list, a review session) is
 * opened while signed out. The landing page is the front door; this is the
 * "you asked for something specific, sign in first" case.
 */
export default function SignIn() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-20">
      <div className="mb-6 text-center">
        <h1 className="jp text-3xl font-bold tracking-tight">ピクニク</h1>
        <p className="mt-2 text-sm text-muted">Sign in to reach your cards.</p>
      </div>
      <SignInForm autoFocus />
      <Link
        href="/"
        className="mt-6 text-center text-xs text-muted underline underline-offset-4 hover:text-foreground"
      >
        ← What is this?
      </Link>
    </main>
  );
}
