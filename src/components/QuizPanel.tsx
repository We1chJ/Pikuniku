"use client";

import { useEffect, useRef, useState } from "react";
import { bind, unbind } from "wanakana";
import { grade, type GradeOutcome } from "@/lib/grader";
import type { Card, TaskKind } from "@/lib/types";

export const TYPE_BG: Record<Card["type"], string> = {
  component: "bg-component",
  primary: "bg-primary",
  compound: "bg-compound",
};

export const TYPE_LABEL: Record<Card["type"], string> = {
  component: "Component",
  primary: "Character",
  compound: "Compound",
};

type Phase = { state: "input" } | { state: "revealed"; outcome: GradeOutcome };

export default function QuizPanel({
  card,
  task,
  deck,
  onResolved,
  progressLabel,
}: {
  card: Card;
  task: TaskKind;
  deck: Card[];
  /** Fires once per *scorable* answer, after the user dismisses the feedback. */
  onResolved: (outcome: GradeOutcome, input: string, elapsedMs: number) => void;
  progressLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef<number>(0);
  const [phase, setPhase] = useState<Phase>({ state: "input" });
  const [retry, setRetry] = useState<{ hint: string; nonce: number } | null>(null);

  // Callers remount this component per question (via `key`), so mount *is* "new
  // question": focus, start the response timer, and — for readings — attach the
  // inline IME that turns romaji into kana as you type. That library is
  // WaniKani's own, and it's what makes exact-match grading on readings fair.
  useEffect(() => {
    const el = inputRef.current;
    startedAt.current = Date.now();
    // preventScroll matters: this panel is also embedded partway down the landing
    // page, and a plain focus() would yank the visitor to it on load.
    el?.focus({ preventScroll: true });
    if (!el || task !== "reading") return;
    bind(el, { IMEMode: true });
    return () => {
      try {
        unbind(el);
      } catch {
        /* already unbound */
      }
    };
  }, [task]);

  function submit() {
    const el = inputRef.current;
    if (!el) return;

    if (phase.state === "revealed") {
      onResolved(phase.outcome, el.value, Date.now() - startedAt.current);
      return;
    }

    const outcome = grade(el.value, card, task, deck);
    if (outcome.kind === "retry") {
      // Not an attempt. Shake, hint, let them try again — no penalty, no log.
      setRetry({ hint: outcome.hint, nonce: Date.now() });
      el.focus();
      return;
    }
    setPhase({ state: "revealed", outcome });
  }

  const revealed = phase.state === "revealed" ? phase.outcome : null;
  const correct = revealed?.kind === "precise" || revealed?.kind === "imprecise";

  const barClass = !revealed
    ? "bg-surface"
    : correct
      ? "bg-correct text-white"
      : "bg-incorrect text-white";

  return (
    <div className="flex w-full flex-1 flex-col">
      <div
        className={`${TYPE_BG[card.type]} flex flex-col items-center justify-center px-6 py-16 text-white`}
      >
        {progressLabel && (
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] uppercase opacity-80">
            {progressLabel}
          </p>
        )}
        <p className="jp text-7xl leading-none font-medium select-none sm:text-8xl">
          {card.front}
        </p>
        <p className="mt-6 text-xs font-semibold tracking-[0.2em] uppercase opacity-80">
          {TYPE_LABEL[card.type]} · {task === "meaning" ? "Meaning" : "Reading"}
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl px-4">
        <div
          key={retry?.nonce}
          className={`${barClass} ${retry ? "animate-shake" : ""} -mt-7 rounded-xl border border-border shadow-lg`}
        >
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            readOnly={!!revealed}
            aria-label={task === "meaning" ? "Meaning answer" : "Reading answer"}
            placeholder={task === "meaning" ? "Your answer" : "答え"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className={`${task === "reading" ? "jp" : ""} w-full bg-transparent px-5 py-4 text-center text-2xl outline-none placeholder:opacity-50`}
          />
        </div>

        {retry && !revealed && (
          <p className="mt-3 text-center text-sm font-medium text-retry">{retry.hint}</p>
        )}

        {revealed && (
          <div className="animate-fade-up mt-5 rounded-xl border border-border bg-surface p-5">
            {revealed.kind === "imprecise" && (
              <p className="mb-2 text-sm font-medium text-retry">
                Close enough — we read that as “{revealed.matched}”.
              </p>
            )}
            {revealed.kind === "wrong" && (
              <p className="mb-2 text-sm font-semibold text-incorrect">Not quite.</p>
            )}
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Meaning</dt>
                <dd className="font-medium">{card.meanings.join(", ")}</dd>
              </div>
              {card.readings.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Reading</dt>
                  <dd className="jp font-medium">{card.readings.join("、")}</dd>
                </div>
              )}
            </dl>
            {card.mnemonic && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted">
                {card.mnemonic}
              </p>
            )}
            <button
              onClick={submit}
              className="mt-4 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background"
            >
              Continue <span className="opacity-60">(Enter)</span>
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          Press Enter to answer. Typos are forgiven; wrong kana is not.
        </p>
      </div>
    </div>
  );
}
