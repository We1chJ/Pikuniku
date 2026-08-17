"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bind, isKatakana, unbind } from "wanakana";
import { aliasPatch, grade, type GradeOutcome } from "@/lib/grader";
import PronounceButton from "./PronounceButton";
import { pronounceable, speak, useJapaneseVoice } from "@/lib/speech";
import CardForm from "./CardForm";
import { READING_TYPE_LABEL, TYPE_LABEL, type Card, type TaskKind } from "@/lib/types";

export const TYPE_BG: Record<Card["type"], string> = {
  component: "bg-component",
  primary: "bg-primary",
  compound: "bg-compound",
};

/**
 * The answered text is kept on the phase rather than read back off the input.
 * Reading a ref during render isn't allowed, and whether the accept shortcut is
 * even offered has to be decided during render.
 */
type Phase =
  | { state: "input" }
  | { state: "revealed"; outcome: GradeOutcome; input: string };

/**
 * Accept-my-answer. Safe as a bare letter because it only does anything once
 * the answer is revealed, and the box is read-only from that point on.
 */
const ALIAS_KEY = "a";

/**
 * A bare "Reading" is ambiguous the moment a character has both an on'yomi and a
 * kun'yomi — you'd be guessing which one we want. Name it when the card knows.
 */
function readingPrompt(card: Card): string {
  return card.readingType
    ? `${READING_TYPE_LABEL[card.readingType]} reading`
    : "Reading";
}

export default function QuizPanel({
  card,
  task,
  deck,
  onResolved,
  onAlias,
  onEdit,
  autoplay = false,
}: {
  card: Card;
  task: TaskKind;
  deck: Card[];
  /** Fires once per *scorable* answer, after the user dismisses the feedback. */
  onResolved: (outcome: GradeOutcome, input: string, elapsedMs: number) => void;
  /** Widen the card so the answer just rejected is accepted from now on. */
  onAlias: (cardId: string, patch: Partial<Card>) => void;
  /** Rewrite the card outright — the typo you only notice under examination. */
  onEdit: (cardId: string, patch: Partial<Card>) => void;
  /** Speak the reading automatically when the answer comes back correct. */
  autoplay?: boolean;
}) {
  const voice = useJapaneseVoice();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef<number>(0);
  const [phase, setPhase] = useState<Phase>({ state: "input" });
  const [retry, setRetry] = useState<{ hint: string } | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);

  /**
   * Restart the shake animation imperatively.
   *
   * The obvious way — changing a React `key` — remounts the input, which throws
   * away both the caret and everything the user typed. Retriggering the CSS
   * animation by hand keeps the same DOM node, so focus and text survive.
   */
  function shake() {
    const bar = barRef.current;
    if (!bar) return;
    bar.classList.remove("animate-shake");
    void bar.offsetWidth; // force reflow so the animation can replay
    bar.classList.add("animate-shake");
  }

  // Meanings stay English; anything answered in Japanese gets transliterated —
  // the same split WaniKani makes. A card whose readings are all katakana
  // (loanwords, onomatopoeia) should produce katakana as you type, not hiragana.
  const japaneseAnswer = task === "reading" || task === "production";
  const imeMode: "toKatakana" | true =
    card.readings.length > 0 && card.readings.every((r) => isKatakana(r))
      ? "toKatakana"
      : true;

  // Callers remount this component per question (via `key`), so mount *is* "new
  // question": focus, start the response timer, and — for readings — attach the
  // inline IME that turns romaji into kana as you type. That library is
  // WaniKani's own, and it's what makes exact-match grading on readings fair.
  useEffect(() => {
    const el = inputRef.current;
    startedAt.current = Date.now();
    el?.focus({ preventScroll: true });
    if (!el || !japaneseAnswer) return;
    bind(el, { IMEMode: imeMode });
    return () => {
      try {
        unbind(el);
      } catch {
        /* already unbound */
      }
    };
  }, [task, imeMode, japaneseAnswer]);

  const submit = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    if (phase.state === "revealed") {
      onResolved(phase.outcome, phase.input, Date.now() - startedAt.current);
      return;
    }

    const outcome = grade(el.value, card, task, deck);
    if (outcome.kind === "retry") {
      // Not an attempt. Shake, hint, let them fix it — no penalty, no log, and
      // their text stays put so they can edit rather than retype.
      setRetry({ hint: outcome.hint });
      shake();
      el.focus({ preventScroll: true });
      return;
    }
    setRetry(null);
    setPhase({ state: "revealed", outcome, input: el.value });
  }, [phase, card, task, deck, onResolved]);

  /**
   * Accept what was just typed, and score the question as if it had been right.
   *
   * Nothing has been committed at this point — `onResolved` only fires when the
   * feedback is dismissed — so there is no penalty to undo. Rewriting the
   * outcome before it leaves the panel is the whole trick: the scheduler, the
   * log and the session queue all see a correct answer, because by the time the
   * card was widened, it was one.
   */
  const accept = useCallback(() => {
    if (phase.state !== "revealed" || phase.outcome.kind !== "wrong") return;
    const patch = aliasPatch(card, task, phase.input);
    if (!patch) return;
    onAlias(card.id, patch);
    setAccepted(phase.input.trim());
    setPhase({ ...phase, outcome: { kind: "precise" } });
  }, [phase, card, task, onAlias]);

  // Re-assert focus on every phase change, so answering — right or wrong — leaves
  // the caret in the box and Enter carries straight on to the next question.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Speak once the answer is revealed, whatever the question was and however it
  // went. Only the revealed phase, though — a shake means the question is still
  // open, and on a reading question the audio would be the answer.
  //
  // Once, and once only. An effect that merely lists its dependencies fires
  // again whenever one of them is rebuilt rather than changed: `card` is a fresh
  // object every time the store refetches, and `voice` a fresh one every time
  // Safari re-enumerates its voices — which it does on tab focus. That played
  // the word again on every tab switch and every window focus. The panel is
  // remounted per question (its key carries the card, task and attempt), so a
  // ref that survives re-renders but not remounts is exactly "this question's
  // answer has been spoken".
  const spoken = useRef(false);
  useEffect(() => {
    if (!autoplay || phase.state !== "revealed" || spoken.current) return;
    spoken.current = true;
    speak(pronounceable(card), voice);
  }, [autoplay, phase.state, card, voice]);

  // The input should never lose the keyboard. If focus drifts — a stray click on
  // the background, a tab-away and back — the next keystroke pulls it back, and
  // Enter still advances. Typing should always just work.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const refocus = () => el.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active === el) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts alone
      // Only reclaim focus from nothing in particular. If the user is in another
      // field, or has tabbed to a link or button, they mean to be there —
      // dragging the caret back here would hijack what they're typing.
      if (
        active instanceof HTMLElement &&
        (active.tagName === "A" ||
          active.tagName === "BUTTON" ||
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        refocus();
        submit();
      } else if (e.key.toLowerCase() === ALIAS_KEY) {
        e.preventDefault();
        refocus();
        accept();
      } else if (e.key.length === 1 || e.key === "Backspace") {
        refocus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("focus", refocus);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("focus", refocus);
    };
  }, [submit, accept]);

  const revealed = phase.state === "revealed" ? phase.outcome : null;
  const correct = revealed?.kind === "precise" || revealed?.kind === "imprecise";

  // Offered only when it would actually change something: a blacklisted answer,
  // or one the card already accepts, would leave the key doing nothing visible.
  const canAlias =
    phase.state === "revealed" &&
    phase.outcome.kind === "wrong" &&
    aliasPatch(card, task, phase.input) !== null;

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
        {/* Production shows the English instead — the whole point is that the
            Japanese is what you have to come up with. */}
        {task === "production" ? (
          <p className="max-w-2xl text-center text-4xl leading-tight font-semibold text-balance select-none sm:text-5xl">
            {card.meanings.join(", ")}
          </p>
        ) : (
          <p className="jp text-7xl leading-none font-medium select-none sm:text-8xl">
            {card.front}
          </p>
        )}
        <p className="mt-6 text-xs font-semibold tracking-[0.2em] uppercase opacity-80">
          {TYPE_LABEL[card.type]} ·{" "}
          {task === "meaning"
            ? "Meaning"
            : task === "production"
              ? "English → Japanese"
              : readingPrompt(card)}
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl px-4">
        <div
          ref={barRef}
          className={`${barClass} -mt-7 rounded-xl border border-border shadow-lg`}
        >
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            readOnly={!!revealed}
            aria-label={`${task} answer`}
            placeholder={japaneseAnswer ? "答え" : "Your answer"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (canAlias && e.key.toLowerCase() === ALIAS_KEY) {
                e.preventDefault();
                accept();
              }
            }}
            className={`${japaneseAnswer ? "jp" : ""} w-full bg-transparent px-5 py-4 text-center text-2xl outline-none placeholder:opacity-50`}
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
            {accepted && (
              <p className="mb-2 text-sm font-medium text-correct">
                Added “{accepted}” to this card. Counted as correct.
              </p>
            )}
            <dl className="space-y-1 text-sm">
              {/* On production the header showed the English, so the word itself
                  is what's missing from the answer panel. */}
              {task === "production" && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Word</dt>
                  <dd className="jp text-lg font-medium">{card.front}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Meaning</dt>
                <dd className="font-medium">{card.meanings.join(", ")}</dd>
              </div>
              {card.readings.length > 0 && (
                <div className="flex items-center gap-2">
                  <dt className="w-20 shrink-0 text-muted">
                    {card.readingType ? READING_TYPE_LABEL[card.readingType] : "Reading"}
                  </dt>
                  <dd className="jp flex items-center gap-2 font-medium">
                    {card.readings.join("、")}
                    <PronounceButton card={card} />
                  </dd>
                </div>
              )}
            </dl>
            {card.mnemonic && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted">
                {card.mnemonic}
              </p>
            )}
            {/* Sits above Continue: it's only useful before you move on, and
                moving on is what the eye goes to first. */}
            {canAlias && (
              <button
                onClick={accept}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                className="mt-4 w-full rounded-lg border border-correct py-2.5 text-sm font-semibold text-correct transition-colors hover:bg-correct hover:text-white"
              >
                <span className="rounded border border-current px-1.5 py-0.5 text-xs">A</span>{" "}
                Accept “{phase.state === "revealed" ? phase.input.trim() : ""}” as{" "}
                {task === "meaning" ? "a meaning" : "an answer"} too
              </button>
            )}
            <button
              onClick={submit}
              tabIndex={-1}
              // Clicking must not pull focus off the input, or the next question
              // would start with the keyboard pointed at a button.
              onMouseDown={(e) => e.preventDefault()}
              className="mt-3 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background"
            >
              Continue <span className="opacity-60">(Enter)</span>
            </button>
            {/* Below Continue, and quiet: a card usually needs answering, not
                mending. It's here rather than beside the prompt because a typo
                is easiest to see with the right answer in front of you. */}
            <button
              onClick={() => setEditing(true)}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              className="mt-3 w-full text-xs text-muted underline underline-offset-4 hover:text-foreground"
            >
              Edit this card
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          {japaneseAnswer
            ? `Press Enter to answer. Romaji becomes ${imeMode === "toKatakana" ? "katakana" : "kana"} as you type.`
            : "Press Enter to answer. Typos are forgiven."}
        </p>
      </div>

      {/* Over the session rather than instead of it: the question stays where it
          was, and closing the form returns you to it mid-answer. Scrolls
          internally, since the form is taller than a phone. */}
      {editing && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/60 p-4">
          <div className="mx-auto w-full max-w-lg py-6">
            <CardForm
              card={card}
              autoFocus
              onSave={(fields) => {
                onEdit(card.id, fields);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
