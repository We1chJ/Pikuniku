"use client";

import { useState } from "react";
import Link from "next/link";
import QuizPanel from "@/components/QuizPanel";
import AutoplayToggle from "@/components/AutoplayToggle";
import SignIn from "@/components/SignIn";
import { useStore, stateFor, newState, tasksFor } from "@/lib/store";
import { applyRating, isDue, outcomeToRating } from "@/lib/scheduler";
import { applyAnswer, buildQueue, pickNext, wordProgress, type SessionMode } from "@/lib/session";
import { dailyBudget } from "@/lib/stats";
import type { Card, Progress, SessionQuestion, TaskKind } from "@/lib/types";
import type { Store } from "@/lib/store";

/**
 * One session, in one of two modes.
 *
 * The modes exist because the dashboard advertises them separately. Merging
 * them into a single queue meant the number on the tile you clicked was never
 * the number of questions you got.
 */
export default function StudySession({ mode }: { mode: SessionMode }) {
  const store = useStore();
  if (!store.ready) {
    return <main className="flex flex-1 items-center justify-center text-muted">Loading…</main>;
  }
  if (!store.signedIn) return <SignIn />;
  // Mounted only once the store has loaded, so the session can be built in a
  // useState initialiser and the current question derived rather than stored.
  return <Session store={store} mode={mode} />;
}

function Session({ store, mode }: { store: Store; mode: SessionMode }) {
  const { cards, progress, recordAnswer } = store;
  const [queue, setQueue] = useState<SessionQuestion[]>(() =>
    buildQueue(
      cards,
      progress,
      store.settings.production,
      dailyBudget(store.settings, store.log).remaining,
      new Date(),
      mode,
    ),
  );
  const [lastCardId, setLastCardId] = useState<string | null>(null);
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });

  const current = pickNext(queue, lastCardId);
  const card = current ? cards.find((c) => c.id === current.cardId) : undefined;
  const progressed = wordProgress(queue);

  if (!current || !card) {
    return (
      <Summary
        tally={tally}
        store={store}
        mode={mode}
        // Granting alone would only change a setting; the queue was built once,
        // so it has to be refilled or the button appears to do nothing.
        onMore={(n) => {
          store.grantExtraLessons(n);
          setQueue(buildQueue(cards, progress, store.settings.production, n, new Date(), "lessons"));
        }}
      />
    );
  }

  return (
    <main className="relative flex flex-1 flex-col">
      {/* How far through the session, in words — no count of what's left, which
          only ever reads as how much is still owed. It rides on top of the
          prompt panel rather than above it, so it takes no layout of its own. */}
      <div
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={progressed.total}
        aria-valuenow={progressed.done}
        className="absolute inset-x-0 top-0 z-20 h-1.5 bg-black/20"
      >
        <div
          className="h-full bg-white/90 transition-[width] duration-500 ease-out"
          style={{ width: `${(progressed.done / progressed.total) * 100}%` }}
        />
      </div>
      {/* Leaving mid-session is safe: every answer is committed as it's given, so
          only the unanswered remainder goes back to the queue. */}
      <Link
        href="/"
        className="absolute top-4 left-4 z-10 rounded-lg px-3 py-1.5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/15 hover:text-white"
      >
        ← Dashboard
      </Link>
      <div className="absolute top-4 right-4 z-10">
        <AutoplayToggle
          on={store.settings.autoplay}
          onChange={(next) => store.setSetting("autoplay", next)}
        />
      </div>
      <QuizPanel
        autoplay={store.settings.autoplay}
        key={`${card.id}:${current.task}:${current.incorrect}`}
        card={card}
        task={current.task}
        deck={cards}
        onAlias={store.updateCard}
        onResolved={(outcome, input, elapsedMs) => {
          const rating = outcomeToRating(outcome, elapsedMs);
          if (rating === null) return; // retry states never resolve

          commit(
            recordAnswer,
            progress,
            card,
            current.task,
            input,
            outcome.kind as "precise" | "imprecise" | "wrong",
            rating,
          );

          const correct = outcome.kind !== "wrong";
          setTally((t) => ({
            correct: t.correct + (correct ? 1 : 0),
            wrong: t.wrong + (correct ? 0 : 1),
          }));
          setLastCardId(card.id);
          setQueue((q) => applyAnswer(q, card.id, current.task, correct));
        }}
      />
    </main>
  );
}

function commit(
  recordAnswer: Store["recordAnswer"],
  progress: Record<string, Progress>,
  card: Card,
  task: TaskKind,
  input: string,
  outcome: "precise" | "imprecise" | "wrong",
  rating: Parameters<typeof applyRating>[1],
) {
  const prior = stateFor(progress, card.id, task) ?? newState();
  recordAnswer(card.id, task, input, outcome, applyRating(prior, rating));
}

function Summary({
  tally,
  store,
  mode,
  onMore,
}: {
  tally: { correct: number; wrong: number };
  store: Store;
  mode: SessionMode;
  onMore: (n: number) => void;
}) {
  const total = tally.correct + tally.wrong;
  const now = new Date();

  // What the *other* mode has waiting, counted in words to match the dashboard.
  // Finishing one and being told nothing is left, while the dashboard shows a
  // full tile, is the confusion this whole split was meant to remove.
  const states = store.cards.map((c) =>
    tasksFor(c, store.settings.production).map((t) => stateFor(store.progress, c.id, t)),
  );
  const unstarted = states.filter((s) => s.some((state) => !state)).length;
  const budget = dailyBudget(store.settings, store.log, now);
  const lessons = Math.min(unstarted, budget.remaining);
  const reviews = states.filter((s) => s.some((state) => state && isDue(state, now))).length;

  const other =
    mode === "lessons"
      ? { count: reviews, href: "/review", label: "reviews due" }
      : { count: lessons, href: "/lessons", label: "lessons ready" };

  // Only lessons are rationed, so only a lesson session can be cut short by it.
  const capped = mode === "lessons" && unstarted > 0 && budget.remaining === 0;

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="jp text-6xl">{total === 0 ? "空" : "終"}</p>
      <h1 className="mt-6 text-2xl font-bold">
        {total > 0
          ? "Session complete"
          : mode === "lessons"
            ? "No lessons right now"
            : "Nothing due right now"}
      </h1>
      {total > 0 ? (
        <p className="mt-3 text-muted">
          {tally.correct} correct, {tally.wrong} missed —{" "}
          {Math.round((tally.correct / total) * 100)}% accuracy.
        </p>
      ) : (
        <p className="mt-3 text-muted">
          {mode === "lessons"
            ? "Every card you own has been started. Add more to keep going."
            : "Everything you’ve studied is scheduled for later."}
        </p>
      )}

      {capped && (
        <div className="mt-6 rounded-xl border border-border bg-surface px-5 py-4">
          <p className="text-sm text-muted">
            {unstarted} new {unstarted === 1 ? "word is" : "words are"} waiting, held back by
            today&rsquo;s limit of {budget.allowance}.
          </p>
          <button
            onClick={() => onMore(5)}
            className="mt-3 rounded-lg bg-component px-4 py-2 text-sm font-semibold text-white"
          >
            Learn 5 more today
          </button>
        </div>
      )}

      {other.count > 0 && (
        <Link
          href={other.href}
          className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white"
        >
          {other.count} {other.label} →
        </Link>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background"
        >
          Dashboard
        </Link>
        <Link
          href="/cards"
          className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold"
        >
          Add cards
        </Link>
      </div>
    </main>
  );
}
