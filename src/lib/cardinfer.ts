/**
 * Working out as much of a card as possible from what you actually typed.
 *
 * The realistic input is a word copied out of a textbook and its meaning. Every
 * other field is either derivable from those two or genuinely optional, and a
 * form that demands them turns a ten-second job into a chore.
 */

import { isKana, isKanji } from "wanakana";
import type { CardType } from "./types";

export function hasKanji(s: string): boolean {
  return [...s].some((ch) => isKanji(ch));
}

/**
 * Textbooks and dictionaries write readings in brackets after the word — 猫(ねこ)
 * or 猫（ねこ）. If that's what got pasted, take it apart rather than making the
 * user do it.
 */
export function splitFuriganaNotation(raw: string): { front: string; reading?: string } {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(.+?)\s*[（(]\s*([぀-ゟ゠-ヿー]+)\s*[)）]$/);
  if (m) return { front: m[1].trim(), reading: m[2] };
  return { front: trimmed };
}

/**
 * A single kanji standing alone is a character; anything longer is a word.
 * "Component" is never inferred — a radical is a decision about how you're
 * studying, not a property of the text, so it stays a manual choice.
 */
export function inferCardType(front: string): CardType {
  const chars = [...front];
  return chars.length === 1 && isKanji(chars[0]) ? "primary" : "compound";
}

/**
 * Whether this card should carry a reading question at all.
 *
 * A word already written in kana *is* its reading, so quizzing it would mean
 * showing ねこ and asking for ねこ. Only text containing kanji hides a reading
 * worth recalling.
 */
export function needsReading(front: string): boolean {
  return hasKanji(front);
}

export function inferReadings(front: string, typed: string): string[] {
  const explicit = typed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;
  return []; // no reading given, and none derivable → meaning-only card
}

/** One line describing what will actually be created, so nothing is a surprise. */
export function describeCard(front: string, readings: string[]): string {
  if (!front.trim()) return "";
  const type = inferCardType(front) === "primary" ? "Character" : "Compound";
  const kana = [...front].every((ch) => isKana(ch));
  if (readings.length > 0) return `${type} · quizzed on meaning and reading`;
  if (kana) return `${type} · already kana, so quizzed on meaning only`;
  return `${type} · quizzed on meaning only`;
}
