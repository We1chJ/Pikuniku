import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="jp text-lg font-bold tracking-tight">
          ピクニク
        </Link>
        <div className="flex gap-5 text-sm font-medium">
          <Link href="/" className="hover:text-primary">
            Dashboard
          </Link>
          <Link href="/cards" className="hover:text-primary">
            Cards
          </Link>
          <Link href="/review" className="hover:text-primary">
            Review
          </Link>
        </div>
      </nav>
    </header>
  );
}
