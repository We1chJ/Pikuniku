"use client";

/**
 * Pronunciation via the browser's built-in speech synthesis.
 *
 * No audio files, no backend, no API key. That isn't just convenience: the whole
 * point of this app is that the cards are yours, so any pre-recorded library
 * would only ever cover somebody else's vocabulary. Synthesis pronounces
 * whatever you wrote.
 *
 * The catch is that voices come from the OS, so a Japanese voice may not exist.
 * Everything here degrades to "no voice" rather than failing loudly.
 */

import { useSyncExternalStore } from "react";

const EMPTY: SpeechSynthesisVoice[] = [];
let voices: SpeechSynthesisVoice[] = EMPTY;
const listeners = new Set<() => void>();

function supported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function refresh() {
  if (!supported()) return;
  const next = window.speechSynthesis.getVoices();
  // Keep the snapshot reference stable unless it genuinely changed, or
  // useSyncExternalStore will loop.
  if (next.length === voices.length && next.every((v, i) => v === voices[i])) return;
  voices = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  if (!supported()) return () => {};
  // Voices load asynchronously in Chrome — often empty on the first call.
  refresh();
  window.speechSynthesis.addEventListener("voiceschanged", refresh);
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    }
  };
}

const getSnapshot = () => voices;
const getServerSnapshot = () => EMPTY;

function pickJapanese(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ja = all.filter((v) => v.lang.toLowerCase().startsWith("ja"));
  if (ja.length === 0) return null;
  // Prefer a local voice: remote ones need network and lag noticeably.
  return ja.find((v) => v.localService) ?? ja[0];
}

/** The best available Japanese voice, or null if the OS has none installed. */
export function useJapaneseVoice(): SpeechSynthesisVoice | null {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return pickJapanese(all);
}

let primed = false;

/**
 * Wake the synthesis engine before it's needed.
 *
 * Remote voices (Chrome's "Google 日本語" among them) hand the text to a server
 * and stream audio back, and the very first call pays for connection setup on
 * top of that. Speaking a silent utterance on the first user gesture gets that
 * cost out of the way while nobody is waiting for it.
 *
 * This only shaves the first-play penalty. The per-play round-trip is inherent
 * to remote voices — installing a local Japanese voice is what removes it.
 */
export function primeSpeech() {
  if (primed || !supported()) return;
  primed = true;
  const warmup = new SpeechSynthesisUtterance("");
  warmup.volume = 0;
  window.speechSynthesis.speak(warmup);
}

export function speak(text: string, voice: SpeechSynthesisVoice | null) {
  if (!supported() || !text) return;
  const synth = window.speechSynthesis;
  // Chrome can leave the engine suspended after idle time; resuming costs
  // nothing when it isn't.
  synth.resume();
  // Only cancel if something is actually queued — an unconditional cancel()
  // makes the engine tear down and rebuild state before every single play.
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "ja-JP";
  utterance.rate = 0.95; // just under natural pace; slower only makes it drag
  synth.speak(utterance);
}

/**
 * What to actually pronounce.
 *
 * Prefer the reading over the characters. Japanese TTS guesses readings from
 * kanji and gets irregular words wrong — 大人 is おとな, but a synthesiser will
 * happily say だいじん. The reading field is the pronunciation, by definition.
 */
export function pronounceable(card: { front: string; readings: string[] }): string {
  return card.readings[0] ?? card.front;
}
