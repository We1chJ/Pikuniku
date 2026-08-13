import Image from "next/image";
import Link from "next/link";
// Imported rather than referenced as "/logo.png": a plain string src is used
// verbatim and does not pick up basePath, so it 404s wherever the app isn't
// served from the domain root — GitHub Pages serves this from /Pikuniku.
// Imported assets go through the build pipeline, which applies basePath.
import logo from "@/assets/logo.png";

export default function Nav() {
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
          <Link href="/review" className="hover:text-primary">
            Review
          </Link>
        </div>
      </nav>
    </header>
  );
}
