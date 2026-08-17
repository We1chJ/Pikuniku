"use client";

/**
 * Pronunciation. No audio files: the cards are yours, so any pre-recorded
 * library would only ever cover somebody else's vocabulary.
 *
 * Two ways to say a word, in this order:
 *
 *   1. The `speak` edge function, which synthesises one pinned Japanese voice.
 *      This is what makes a word sound the same on a Mac as on Windows.
 *   2. The browser's own speech synthesis, using whichever Japanese voice the OS
 *      installed — which is where the inconsistency came from, and why it is now
 *      the fallback rather than the mechanism.
 *
 * Everything degrades rather than failing loudly: no Supabase, a function that's
 * down, or a machine with no Japanese voice at all each drop to the next option,
 * and the last of them is silence.
 */

import { useSyncExternalStore } from "react";
import { supabase, isRemote } from "./supabase";

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

/**
 * Whether there's any way to speak at all — the synthesised voice counts even
 * before a clip has been fetched, so the button doesn't wait on the network to
 * decide whether it exists.
 */
export function useCanSpeak(): boolean {
  return useJapaneseVoice() !== null || isRemote;
}

/* ------------------------------------------------------------------ *
 * The synthesised voice
 * ------------------------------------------------------------------ */

/**
 * Clips already fetched this session, by text.
 *
 * Held in memory and nowhere else: a review session says the same handful of
 * words several times over, and paying a round trip for each repeat is the only
 * real cost of moving off the OS voice. Closing the tab forgets them.
 */
const clips = new Map<string, string>();
/** Requests in flight, so a prefetch and a click don't both ask. */
const inFlight = new Map<string, Promise<string | null>>();

let audio: HTMLAudioElement | null = null;

async function fetchClip(text: string): Promise<string | null> {
  const ready = clips.get(text);
  if (ready) return ready;
  if (!supabase) return null;

  const existing = inFlight.get(text);
  if (existing) return existing;

  const request = supabase.functions
    .invoke("speak", { body: { text } })
    .then(({ data, error }) => {
      if (error || !(data instanceof Blob)) {
        // Falling back quietly is right for whoever is studying, but not for
        // whoever is trying to work out why they still hear the OS voice.
        console.warn("[speech] no synthesised clip, using the OS voice:", error);
        return null;
      }
      const url = URL.createObjectURL(data);
      clips.set(text, url);
      return url;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(text));

  inFlight.set(text, request);
  return request;
}

/**
 * Warm a clip before it's wanted.
 *
 * Called as a question appears, so that pressing play is a cache hit rather than
 * a round trip. It also keeps playback inside the click that asked for it, which
 * is what Safari's autoplay rules require — audio started after an await has
 * lost its user gesture and can be refused.
 */
export function prefetchSpeech(text: string) {
  if (!isRemote || !text) return;
  void fetchClip(text);
}

function play(url: string) {
  audio = new Audio(url);
  // A refusal here is a browser autoplay policy, not a fault to report.
  void audio.play().catch(() => {});
}

function stop() {
  audio?.pause();
  audio = null;
  if (!supported()) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
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

/**
 * Say a word, in the best voice available.
 *
 * `fallback` is the OS voice to use if the synthesised one can't be had — pass
 * whatever `useJapaneseVoice` gave you, including null.
 */
export function speak(text: string, fallback: SpeechSynthesisVoice | null) {
  if (!text) return;
  // Only cancels what is actually playing — an unconditional cancel() makes the
  // synthesis engine tear down and rebuild its state before every single play.
  stop();

  // A clip already in hand plays inside the gesture that asked for it, which is
  // both instant and what the autoplay rules want.
  const ready = clips.get(text);
  if (ready) return play(ready);

  if (isRemote) {
    void fetchClip(text).then((url) => (url ? play(url) : speakLocally(text, fallback)));
    return;
  }
  speakLocally(text, fallback);
}

function speakLocally(text: string, voice: SpeechSynthesisVoice | null) {
  if (!supported()) return;
  const synth = window.speechSynthesis;
  // Chrome can leave the engine suspended after idle time; resuming costs
  // nothing when it isn't.
  synth.resume();
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
