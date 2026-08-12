"use client";

import { useJapaneseVoice } from "@/lib/speech";

export default function AutoplayToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  const voice = useJapaneseVoice();
  // Nothing to toggle if the OS can't speak Japanese at all.
  if (!voice) return null;

  return (
    <button
      type="button"
      tabIndex={-1}
      // Must not pull focus off the answer input.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      title={
        on
          ? "Auto-pronounce on correct answers: on"
          : "Auto-pronounce on correct answers: off"
      }
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        on
          ? "bg-white/20 text-white"
          : "text-white/60 hover:bg-white/10 hover:text-white/90"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 5 6 9H3v6h3l5 4z" strokeLinejoin="round" />
        {on ? (
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
        ) : (
          <path d="m16 9 5 6m0-6-5 6" strokeLinecap="round" />
        )}
      </svg>
      Auto
    </button>
  );
}
