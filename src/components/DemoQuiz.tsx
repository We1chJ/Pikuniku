"use client";

import { useState } from "react";
import QuizPanel from "./QuizPanel";
import { SEED_CARDS } from "@/lib/seed";
import type { Card, TaskKind } from "@/lib/types";

const DEMO: Card[] = SEED_CARDS.slice(0, 4).map((c, i) => ({
  ...c,
  id: `demo-${i}`,
  createdAt: 0,
}));

const STEPS: { card: Card; task: TaskKind }[] = DEMO.flatMap((card) => [
  { card, task: "meaning" as const },
  { card, task: "reading" as const },
]);

/** A real review, wired to the real grader — nothing is scheduled or saved. */
export default function DemoQuiz() {
  const [i, setI] = useState(0);
  const step = STEPS[i % STEPS.length];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface pb-8 shadow-sm">
      <QuizPanel
        key={i}
        card={step.card}
        task={step.task}
        deck={DEMO}
        progressLabel="Demo — nothing is saved"
        onResolved={() => setI((n) => n + 1)}
      />
    </div>
  );
}
