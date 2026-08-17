"use client";

import { useEffect } from "react";
import { hasKanji } from "@/lib/cardinfer";
import { primeSpeech, pronounceable, speak, useCanSpeak, useJapaneseVoice } from "@/lib/speech";
import type { Card } from "@/lib/types";

/**
 * Renders nothing when there's no way to speak, or nothing safe to say — a
 * button that does nothing, or says the wrong thing, is worse than no button.
 *
 * Bare as an icon where it sits beside the text it speaks, labelled where it
 * has to be found rather than recognised.
 */
export default function PronounceButton({
  card,
  className = "",
  label,
}: {
  card: Pick<Card, "front" | "readings">;
  className?: string;
  /** Give it a word and it becomes a full control instead of a glyph. */
  label?: string;
}) {
  const voice = useJapaneseVoice();
  const canSpeak = useCanSpeak();

  // Warm the engine on the first interaction anywhere on the page, so the first
  // press of this button isn't the one that pays for connection setup.
  useEffect(() => {
    const onFirstGesture = () => primeSpeech();
    document.addEventListener("pointerdown", onFirstGesture, { once: true });
    document.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  // No prefetch here on purpose: this button also appears on every row of the
  // card list, and warming all of them would be hundreds of requests for a
  // handful of plays. The quiz panel warms the one word you're being asked.
  if (!canSpeak) return null;

  const text = pronounceable(card);
  // A card with no reading falls back to its own characters, and a synthesiser
  // handed bare kanji guesses — 大人 comes out だいじん. Offering to play that
  // would be offering to teach the wrong pronunciation.
  if (hasKanji(text)) return null;

  return (
    <button
      type="button"
      tabIndex={-1}
      // Never pull focus off the answer input.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => speak(text, voice)}
      title={`Play ${text}`}
      aria-label={`Play pronunciation of ${text}`}
      className={
        label
          ? `inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-accent hover:text-accent ${className}`
          : `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:border-accent hover:text-accent ${className}`
      }
    >
      <svg
        viewBox="0 0 24 24"
        className={label ? "h-3.5 w-3.5" : "h-4 w-4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M11 5 6 9H3v6h3l5 4z" strokeLinejoin="round" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}
