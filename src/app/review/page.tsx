"use client";

import { useState } from "react";
import Link from "next/link";
import QuizPanel from "@/components/QuizPanel";
import AutoplayToggle from "@/components/AutoplayToggle";
import SignIn from "@/components/SignIn";
import { useStore, stateFor, newState } from "@/lib/store";
import { applyRating, outcomeToRating } from "@/lib/scheduler";
import { applyAnswer, buildQueue, pickNext, remaining } from "@/lib/session";
import { lessonsStartedToday } from "@/lib/stats";
import type { Card, Progress, SessionQuestion, TaskKind } from "@/lib/types";
import type { Store } from "@/lib/store";

export default function Review() {
  const store = useStore();
  if (!store.ready) {
    return <main className="flex flex-1 items-center justify-center text-muted">Loading…</main>;
  }
  if (!store.signedIn) return <SignIn />;
  // Mounted only once the store has loaded, so the session can be built in a
  // useState initialiser and the current question derived rather than stored.
  return <Session store={store} />;
}

function Session({ store }: { store: Store }) {
  const { cards, progress, recordAnswer } = store;
  const [queue, setQueue] = useState<SessionQuestion[]>(() =>
    buildQueue(
      cards,
      progress,
      store.settings.production,
      Math.max(0, store.settings.dailyLessons - lessonsStartedToday(store.log)),
    ),
  );
  const [lastCardId, setLastCardId] = useState<string | null>(null);
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });

  const current = pickNext(queue, lastCardId);
  const card = current ? cards.find((c) => c.id === current.cardId) : undefined;

  if (!current || !card) return <Summary tally={tally} />;

  return (
    <main className="relative flex flex-1 flex-col">
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
        progressLabel={`${remaining(queue)} left`}
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

function Summary({ tally }: { tally: { correct: number; wrong: number } }) {
  const total = tally.correct + tally.wrong;
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="jp text-6xl">{total === 0 ? "空" : "終"}</p>
      <h1 className="mt-6 text-2xl font-bold">
        {total === 0 ? "Nothing due right now" : "Session complete"}
      </h1>
      {total > 0 ? (
        <p className="mt-3 text-muted">
          {tally.correct} correct, {tally.wrong} missed —{" "}
          {Math.round((tally.correct / total) * 100)}% accuracy.
        </p>
      ) : (
        <p className="mt-3 text-muted">
          Everything you&rsquo;ve studied is scheduled for later. Add cards, or come back when
          the next batch is due.
        </p>
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
