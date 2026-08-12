/**
 * Scheduling — FSRS (via ts-fsrs), wearing WaniKani's clothes.
 *
 * Decision recorded in plan §6.2: FSRS does the actual scheduling, but we keep
 * three things from WaniKani because they're what make it feel good:
 *
 *   1. No self-rating. The user types an answer; the *grader's* verdict becomes
 *      the FSRS rating. That mapping is the whole trick (§6.2).
 *   2. Same-day reinforcement. Learning steps of 4h/8h echo the Apprentice ladder,
 *      so a new or failed card comes back today rather than tomorrow.
 *   3. Due times truncated to the hour (§1.3), so reviews arrive in predictable
 *      batches instead of dribbling in minute by minute.
 */

import { createEmptyCard, fsrs, Rating, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { FsrsState } from "./types";
import type { GradeOutcome } from "./grader";

const scheduler = fsrs({
  enable_short_term: true,
  learning_steps: ["4h", "8h"],
  relearning_steps: ["4h"],
  enable_fuzz: true,
});

/** Answering this fast means it was genuinely automatic, not recalled. */
const EASY_MS = 4000;

/**
 * Grader verdict → FSRS rating. This is what lets a typed-recall UI drive a
 * four-button algorithm without ever asking the user to introspect.
 */
export function outcomeToRating(o: GradeOutcome, elapsedMs: number): Grade | null {
  switch (o.kind) {
    case "precise":
      return elapsedMs <= EASY_MS ? Rating.Easy : Rating.Good;
    case "imprecise":
      return Rating.Hard; // knew it, fumbled the spelling
    case "wrong":
      return Rating.Again;
    case "retry":
      return null; // not an attempt at all
  }
}

/** Reviews arrive on the hour — but never round a same-hour step into the past. */
function floorToHour(d: Date, now: Date): Date {
  const floored = new Date(d);
  floored.setMinutes(0, 0, 0);
  return floored > now ? floored : d;
}

export function newState(): FsrsState {
  return serialize(createEmptyCard());
}

function serialize(c: FsrsCard): FsrsState {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.toISOString(),
  };
}

function deserialize(s: FsrsState): FsrsCard {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as FsrsCard;
}

export function applyRating(state: FsrsState, rating: Grade, now = new Date()): FsrsState {
  const { card } = scheduler.next(deserialize(state), now, rating);
  return serialize({ ...card, due: floorToHour(card.due, now) });
}

export function isDue(state: FsrsState | undefined, now = new Date()): boolean {
  if (!state) return true; // never studied → it's a lesson, which counts as due
  return new Date(state.due) <= now;
}

/* ------------------------------------------------------------------ *
 * Stage labels
 *
 * FSRS has no stages, but "Burned" is a real motivator and `stability =
 * 47.3 days` is not. So we derive WaniKani's five groups from stability and
 * use them purely for display (§6.2).
 * ------------------------------------------------------------------ */

export const STAGES = [
  "Apprentice",
  "Guru",
  "Master",
  "Enlightened",
  "Burned",
] as const;
export type Stage = (typeof STAGES)[number];

export function stageOf(state: FsrsState | undefined): Stage | "Lesson" {
  if (!state || state.reps === 0) return "Lesson";
  const s = state.stability;
  if (s < 7) return "Apprentice";
  if (s < 30) return "Guru";
  if (s < 90) return "Master";
  if (s < 180) return "Enlightened";
  return "Burned";
}

export const STAGE_CLASS: Record<Stage | "Lesson", string> = {
  Lesson: "bg-slate-400",
  Apprentice: "bg-stage-apprentice",
  Guru: "bg-stage-guru",
  Master: "bg-stage-master",
  Enlightened: "bg-stage-enlightened",
  Burned: "bg-stage-burned",
};

/** "in 4 hours" / "in 3 days" — the dashboard reads better than a timestamp. */
export function untilDue(state: FsrsState | undefined, now = new Date()): string {
  if (!state) return "available now";
  const ms = new Date(state.due).getTime() - now.getTime();
  if (ms <= 0) return "available now";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `in ${days}d`;
  return `in ${Math.round(days / 30)}mo`;
}
