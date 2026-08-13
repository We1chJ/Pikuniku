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
 * How many *new* items were started today.
 *
 * A lesson is the first time a question is ever answered, so it's the earliest
 * log entry for that (card, task) pair — not simply an entry dated today, which
 * would count every ordinary review as a lesson.
 */
export function lessonsStartedToday(log: ReviewLogEntry[], now = new Date()): number {
  const firstSeen = new Map<string, number>();
  for (const entry of log) {
    const key = `${entry.cardId}:${entry.task}`;
    const at = firstSeen.get(key);
    if (at === undefined || entry.at < at) firstSeen.set(key, entry.at);
  }
  const today = dayKey(now);
  let count = 0;
  for (const at of firstSeen.values()) {
    if (dayKey(new Date(at)) === today) count += 1;
  }
  return count;
}

export interface DayCount {
  key: string;
  date: Date;
  count: number;
}

/**
 * Answers per day for the last `days` days, oldest first, with empty days
 * included — a heatmap needs the gaps as much as the activity.
 */
export function answersByDay(
  log: ReviewLogEntry[],
  days: number,
  now = new Date(),
): DayCount[] {
  const counts = new Map<string, number>();
  for (const entry of log) {
    const key = dayKey(new Date(entry.at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: DayCount[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dayKey(date);
    out.push({ key, date, count: counts.get(key) ?? 0 });
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
