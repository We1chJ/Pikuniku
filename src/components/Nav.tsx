"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/lib/store";
// Imported rather than referenced as "/logo.png": a plain string src is used
// verbatim and does not pick up basePath, so it 404s wherever the app isn't
// served from the domain root — GitHub Pages serves this from /Pikuniku.
// Imported assets go through the build pipeline, which applies basePath.
import logo from "@/assets/logo.png";

export default function Nav() {
  // Only remote mode has an account to be in or out of — running on
  // localStorage there is nothing to sign into, so the bar ends at the links.
  const { remote, signedIn, email, signOut } = useStore();

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={logo}
            alt=""
            width={28}
            height={20}
            priority
            className="logo-glyph"
          />
          <span className="jp text-lg font-bold tracking-tight">ピクニク</span>
        </Link>
        <div className="flex gap-5 text-sm font-medium">
          <Link href="/" className="hover:text-primary">
            Dashboard
          </Link>
          <Link href="/cards" className="hover:text-primary">
            Cards
          </Link>
          <Link href="/lessons" className="hover:text-primary">
            Lessons
          </Link>
          <Link href="/review" className="hover:text-primary">
            Review
          </Link>
        </div>
        {remote && signedIn && (
          <div className="ml-auto flex items-center gap-3">
            {/* The address crowds the links on a narrow window, and it's the
                button that has to be reachable — so it's the address that goes. */}
            <span className="hidden text-xs text-muted sm:inline">{email}</span>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
            >
              Sign out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
