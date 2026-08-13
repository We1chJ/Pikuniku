/**
 * Derived history, computed from the review log.
 *
 * The log is the only durable record of what happened when — progress rows only
 * hold current state — which is why it is append-only and why these read from it
 * rather than from anything summarised.
 */

import type { ReviewLogEntry } from "./types";

/** Local-time day key. Using UTC here would roll the day over mid-evening. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * When each question was first ever answered.
 *
 * This is what "learning an item" means here: the earliest log entry for a
 * (card, task) pair — not simply an entry dated today, which would count every
 * ordinary review as a lesson. Both the daily budget and the growth curve are
 * counted from it, so they agree by construction.
 */
function firstSeenAt(log: ReviewLogEntry[]): Map<string, number> {
  const firstSeen = new Map<string, number>();
  for (const entry of log) {
    const key = `${entry.cardId}:${entry.task}`;
    const at = firstSeen.get(key);
    if (at === undefined || entry.at < at) firstSeen.set(key, entry.at);
  }
  return firstSeen;
}

/** How many *new* items were started today. */
export function lessonsStartedToday(log: ReviewLogEntry[], now = new Date()): number {
  const today = dayKey(now);
  let count = 0;
  for (const at of firstSeenAt(log).values()) {
    if (dayKey(new Date(at)) === today) count += 1;
  }
  return count;
}

export interface DailyBudget {
  /** Today's ceiling, including anything granted by "learn more". */
  allowance: number;
  started: number;
  remaining: number;
}

/**
 * The single answer to "how many new items may I start right now".
 *
 * Both the dashboard and the review queue read this, so the number shown and
 * the number enforced can't drift apart.
 */
export function dailyBudget(
  settings: { dailyLessons: number; bonusDay: string; bonusCount: number },
  log: ReviewLogEntry[],
  now = new Date(),
): DailyBudget {
  // The bonus is stamped with the day it was granted, so it expires by itself
  // at midnight rather than needing anything to reset it.
  const bonus = settings.bonusDay === dayKey(now) ? settings.bonusCount : 0;
  const allowance = settings.dailyLessons + bonus;
  const started = lessonsStartedToday(log, now);
  return { allowance, started, remaining: Math.max(0, allowance - started) };
}

/** Half a year — the window both activity charts cover. */
export const ACTIVITY_DAYS = 26 * 7;

export interface DayStat {
  key: string;
  date: Date;
  /** Every answer given that day, typo-forgiven ones included. */
  count: number;
  /**
   * Answers that count toward accuracy, and how many were clean. Typo-forgiven
   * answers are excluded from both, matching the dashboard's overall figure.
   */
  scored: number;
  precise: number;
  /** Questions seen for the very first time that day. */
  learned: number;
  /** Distinct questions ever started, as of the end of this day. */
  total: number;
}

/**
 * Per-day history for the last `days` days, oldest first, empty days included —
 * a heatmap needs the gaps as much as the activity, and a line through them has
 * to be flat rather than absent.
 */
export function dailyStats(
  log: ReviewLogEntry[],
  days: number,
  now = new Date(),
): DayStat[] {
  const counts = new Map<string, { count: number; scored: number; precise: number }>();
  for (const entry of log) {
    const key = dayKey(new Date(entry.at));
    const day = counts.get(key) ?? { count: 0, scored: 0, precise: 0 };
    day.count += 1;
    if (entry.outcome !== "imprecise") {
      day.scored += 1;
      if (entry.outcome === "precise") day.precise += 1;
    }
    counts.set(key, day);
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  // Anything learned before the window still counts toward the running total,
  // or the curve would start at zero and understate everything after it.
  const learnedOn = new Map<string, number>();
  let total = 0;
  for (const at of firstSeenAt(log).values()) {
    if (at < start.getTime()) {
      total += 1;
      continue;
    }
    const key = dayKey(new Date(at));
    learnedOn.set(key, (learnedOn.get(key) ?? 0) + 1);
  }

  const out: DayStat[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dayKey(date);
    const day = counts.get(key) ?? { count: 0, scored: 0, precise: 0 };
    const learned = learnedOn.get(key) ?? 0;
    total += learned;
    out.push({ key, date, ...day, learned, total });
  }
  return out;
}

/** Consecutive days with at least one answer, counting back from today. */
export function currentStreak(log: ReviewLogEntry[], now = new Date()): number {
  const active = new Set(log.map((e) => dayKey(new Date(e.at))));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  // Today not being done yet shouldn't break a streak, so start from yesterday
  // if there's nothing today.
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (active.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
