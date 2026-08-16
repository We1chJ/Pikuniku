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
  /** Remaining new *words* allowed today. Reviews are never withheld. */
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
    const tasks = tasksFor(card);
    // Never studied → a lesson, and lessons are what get paced. Studied and due
    // → a review. A card can hold both, which is why they're split rather than
    // filtered from one list.
    const wanted =
      mode === "lessons"
        ? tasks.filter((t) => !progress[card.id]?.tasks?.[t])
        : tasks.filter((t) => {
            const state = progress[card.id]?.tasks?.[t];
            return state && isDue(state, now);
          });
    if (wanted.length === 0) continue;
    // The budget is spent per *word*, not per question, and buys every way that
    // word is tested. Charging per question meant turning on English → Japanese
    // silently cut a five-lesson day down to three words.
    if (mode === "lessons") {
      if (budget <= 0) continue;
      budget -= 1;
    }
    for (const task of wanted) {
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

/**
 * How far through the session you are, counted in words.
 *
 * A word only lands once every way it's tested has been answered, so the bar
 * moves in whole steps you can feel — the WaniKani reading of "done", rather
 * than a count that jumps by a third whenever a card has three questions.
 */
export function wordProgress(queue: SessionQuestion[]): { done: number; total: number } {
  const pending = new Set<string>();
  const all = new Set<string>();
  for (const q of queue) {
    all.add(q.cardId);
    if (!q.answered) pending.add(q.cardId);
  }
  return { done: all.size - pending.size, total: all.size };
}
