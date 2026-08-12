/**
 * The answer grading engine — a direct port of WaniKani's behaviour (§1.6, §3.3).
 *
 * Three things make this feel right rather than hostile:
 *   1. Meanings are fuzzy-matched with a length-scaled edit-distance tolerance.
 *   2. Readings are matched exactly — a wrong kana is a real error, not a typo.
 *   3. There is a third outcome between right and wrong ("retry"), for answers
 *      that reveal adjacent knowledge or a wrong input mode. These never count
 *      against you.
 */

import { isJapanese, isRomaji, toHiragana } from "wanakana";
import type { Card, TaskKind } from "./types";

export type RetryReason =
  | "empty"
  | "script-mismatch"
  | "other-reading"
  | "alternate-match";

export type GradeOutcome =
  | { kind: "precise" }
  | { kind: "imprecise"; matched: string }
  | { kind: "retry"; reason: RetryReason; hint: string }
  | { kind: "wrong" };

/**
 * Optimal String Alignment distance: Levenshtein plus adjacent transpositions.
 *
 * We use OSA rather than plain Levenshtein deliberately (see plan §1.6). Tsurukame
 * ships plain Levenshtein, but transposition is one of the four dominant typo
 * classes — "teh" for "the" should cost 1, not 2.
 */
export function osaDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Three rolling rows are all OSA needs: it never looks back further than two.
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let curr: number[] = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, prev2[j - 2] + 1); // transposition
      }
      curr[j] = best;
    }
    prev2 = prev;
    prev = curr;
    curr = new Array(n + 1);
  }
  return prev[n];
}

/**
 * How many edits we forgive, as a function of the *expected* answer's length.
 * Constants confirmed against Tsurukame's AnswerChecker.swift (plan §1.6).
 */
export function maxDistance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 7) return 2;
  return 2 + Math.floor(len / 7);
}

export function normalizeMeaning(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[-.'/]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeReading(s: string): string {
  return toHiragana(s.trim().toLowerCase().replace(/\s+/g, ""));
}

function gradeMeaning(input: string, card: Card, deck: Card[]): GradeOutcome {
  const raw = input.trim();
  if (!raw) return { kind: "retry", reason: "empty", hint: "Type an answer." };

  // Japanese in the meaning box is an input-mode slip, not a wrong answer.
  if (isJapanese(raw)) {
    return {
      kind: "retry",
      reason: "script-mismatch",
      hint: "We're looking for the meaning, in English.",
    };
  }

  const answer = normalizeMeaning(raw);

  // Blacklist wins over everything, including an otherwise-exact match.
  if (card.blacklist.some((b) => normalizeMeaning(b) === answer)) {
    return { kind: "wrong" };
  }

  const accepted = card.meanings.map(normalizeMeaning);
  if (accepted.includes(answer)) return { kind: "precise" };

  for (let i = 0; i < accepted.length; i++) {
    const target = accepted[i];
    if (osaDistance(answer, target) <= maxDistance(target.length)) {
      return { kind: "imprecise", matched: card.meanings[i] };
    }
  }

  // KameSame's "Smart Alternate Matches" (§1.7.1): a valid answer to a *different*
  // card is adjacent knowledge, not ignorance. Ask again rather than penalise.
  const other = deck.find(
    (c) => c.id !== card.id && c.meanings.some((m) => normalizeMeaning(m) === answer),
  );
  if (other) {
    return {
      kind: "retry",
      reason: "alternate-match",
      hint: `That's ${other.front} — we're looking for a different card.`,
    };
  }

  return { kind: "wrong" };
}

function gradeReading(input: string, card: Card): GradeOutcome {
  const raw = input.trim();
  if (!raw) return { kind: "retry", reason: "empty", hint: "Type an answer." };

  // Romaji that didn't finish converting, or plain English, is an input-mode slip.
  if (isRomaji(raw)) {
    return {
      kind: "retry",
      reason: "script-mismatch",
      hint: "We're looking for the reading, in kana.",
    };
  }

  const answer = normalizeReading(raw);

  if (card.readings.map(normalizeReading).includes(answer)) {
    return { kind: "precise" };
  }

  // A real reading, just not the one being taught → retry, never wrong.
  if (card.altReadings.map(normalizeReading).includes(answer)) {
    return {
      kind: "retry",
      reason: "other-reading",
      hint: "That's a real reading, but not the one we want here.",
    };
  }

  // Readings are exact-match only. No fuzzy tolerance: a wrong kana is a wrong
  // sound, and forgiving it would teach the wrong word.
  return { kind: "wrong" };
}

export function grade(
  input: string,
  card: Card,
  task: TaskKind,
  deck: Card[] = [],
): GradeOutcome {
  return task === "meaning"
    ? gradeMeaning(input, card, deck)
    : gradeReading(input, card);
}

/** Does this outcome count as an attempt that moves the scheduler? */
export function isScorable(o: GradeOutcome): boolean {
  return o.kind !== "retry";
}
