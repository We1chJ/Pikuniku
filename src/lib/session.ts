/**
 * In-session question queue (plan §3.7).
 *
 * Modelled on KanjiSchool's chooseQuestion.ts rather than on WaniKani itself,
 * because WaniKani's own re-queue distance is effectively zero — a missed item
 * can reappear seconds after you were shown the answer, which tests working
 * memory rather than recall. Here a wrong answer sets a delay that is honoured
 * as long as any other candidate exists, and degrades gracefully at the end of a
 * session when only the missed questions remain.
 */

import type { Card, Progress, SessionQuestion, TaskKind } from "./types";
import { isDue } from "./scheduler";
import { tasksFor } from "./store";

/** Lessons are material you've never seen; reviews are material coming back. */
export type SessionMode = "lessons" | "reviews";

/** How many other questions must pass before a missed one may return. */
export const REQUEUE_DELAY = 4;
/** Cap on half-finished cards, to bound working-memory load. */
export const MAX_STARTED = 10;

/**
 * The queue is shuffled once, here, and then read in order. Picking randomly on
 * every step would make `current` impure to derive; shuffling up front gets the
 * same unpredictability with none of that. Order still matters: a strictly
 * predictable queue lets you answer from position instead of recall.
 */
export function buildQueue(
  cards: Card[],
  progress: Record<string, Progress>,
  production = false,
  /** Remaining new items allowed today. Reviews are never withheld. */
  lessonBudget = Infinity,
  now = new Date(),
  /**
   * Which half of the work to queue. They're kept apart because the dashboard
   * counts them apart: a session that silently merged both meant clicking "2
   * reviews" started a run of 23 questions.
   */
  mode: SessionMode = "reviews",
): SessionQuestion[] {
  const queue: SessionQuestion[] = [];
  let budget = lessonBudget;
  for (const card of cards) {
    for (const task of tasksFor(card, production)) {
      const state = progress[card.id]?.tasks?.[task];
      if (!isDue(state, now)) continue;
      if (!state) {
        // Never studied — this is a lesson, and lessons are what get paced.
        if (mode === "reviews") continue;
        if (budget <= 0) continue;
        budget -= 1;
      } else if (mode === "lessons") {
        continue;
      }
      queue.push({ cardId: card.id, task, choiceDelay: 0, answered: false, incorrect: 0 });
    }
  }
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

/** Cards that have at least one answered task and at least one still pending. */
function startedCardIds(queue: SessionQuestion[]): Set<string> {
  const byCard = new Map<string, { done: number; total: number }>();
  for (const q of queue) {
    const e = byCard.get(q.cardId) ?? { done: 0, total: 0 };
    e.total += 1;
    if (q.answered) e.done += 1;
    byCard.set(q.cardId, e);
  }
  const started = new Set<string>();
  for (const [id, e] of byCard) {
    if (e.done > 0 && e.done < e.total) started.add(id);
  }
  return started;
}

/** Pure: same queue in, same question out — so callers can derive it in render. */
export function pickNext(
  queue: SessionQuestion[],
  lastCardId: string | null,
): SessionQuestion | null {
  const pending = queue.filter((q) => !q.answered);
  if (pending.length === 0) return null;

  // Honour the re-queue delay only while something else is available.
  const undelayed = pending.filter((q) => q.choiceDelay <= 0);
  let pool = undelayed.length > 0 ? undelayed : pending;

  // Once too many cards are half-finished, stop opening new ones.
  const started = startedCardIds(queue);
  if (started.size >= MAX_STARTED) {
    const fromStarted = pool.filter((q) => started.has(q.cardId));
    if (fromStarted.length > 0) pool = fromStarted;
  }

  // Don't show the same card's two tasks back to back if we can avoid it —
  // scattering them is a stronger test than answering both in one breath.
  if (pool.length > 1 && lastCardId) {
    const others = pool.filter((q) => q.cardId !== lastCardId);
    if (others.length > 0) pool = others;
  }

  return pool[0];
}

/** Advance the queue after an answer. Returns a new array; never mutates. */
export function applyAnswer(
  queue: SessionQuestion[],
  cardId: string,
  task: TaskKind,
  correct: boolean,
): SessionQuestion[] {
  return queue.map((q) => {
    const isTarget = q.cardId === cardId && q.task === task;
    if (isTarget) {
      return correct
        ? { ...q, answered: true, choiceDelay: 0 }
        : { ...q, incorrect: q.incorrect + 1, choiceDelay: REQUEUE_DELAY };
    }
    // Everything else ticks one step closer to being eligible again.
    return q.choiceDelay > 0 ? { ...q, choiceDelay: q.choiceDelay - 1 } : q;
  });
}

export function remaining(queue: SessionQuestion[]): number {
  return queue.filter((q) => !q.answered).length;
}
