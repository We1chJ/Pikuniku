"use client";

import { useEffect } from "react";
import { primeSpeech, pronounceable, speak, useJapaneseVoice } from "@/lib/speech";
import type { Card } from "@/lib/types";

/**
 * Renders nothing when the OS has no Japanese voice — a button that silently
 * does nothing is worse than no button.
 */
export default function PronounceButton({
  card,
  className = "",
}: {
  card: Pick<Card, "front" | "readings">;
  className?: string;
}) {
  const voice = useJapaneseVoice();

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

  if (!voice) return null;

  return (
    <button
      type="button"
      tabIndex={-1}
      // Never pull focus off the answer input.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => speak(pronounceable(card), voice)}
      title={`Play ${pronounceable(card)}`}
      aria-label={`Play pronunciation of ${pronounceable(card)}`}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:border-accent hover:text-accent ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 5 6 9H3v6h3l5 4z" strokeLinejoin="round" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
      </svg>
    </button>
  );
}
