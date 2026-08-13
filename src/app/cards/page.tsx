"use client";

import { useRef, useState } from "react";
import { bind, unbind } from "wanakana";
import Nav from "@/components/Nav";
import SignIn from "@/components/SignIn";
import PronounceButton from "@/components/PronounceButton";
import { useStore, tasksFor } from "@/lib/store";
import { TYPE_LABEL } from "@/components/QuizPanel";
import {
  describeCard,
  inferCardType,
  inferReadings,
  needsReading,
  splitFuriganaNotation,
} from "@/lib/cardinfer";
import {
  READING_TYPE_LABEL,
  type AltReading,
  type CardType,
  type ReadingType,
} from "@/lib/types";

const TYPES: CardType[] = ["component", "primary", "compound"];
const TYPE_DOT: Record<CardType, string> = {
  component: "bg-component",
  primary: "bg-primary",
  compound: "bg-compound",
};

const empty = {
  front: "",
  meaning: "",
  reading: "",
  // Everything below is optional and lives behind "More options".
  type: "" as "" | CardType,
  readingType: "" as "" | ReadingType,
  altReadings: "",
  blacklist: "",
  mnemonic: "",
};

function split(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** "にん (on), ひと (kun)" — the bracketed type is what sharpens the shake hint. */
function splitAltReadings(s: string): AltReading[] {
  return split(s).map((entry) => {
    const m = entry.match(/^(.+?)\s*[（(]\s*(on|kun|nanori)[a-z']*\s*[)）]$/i);
    if (!m) return { reading: entry };
    const kind = m[2].toLowerCase();
    return {
      reading: m[1].trim(),
      type: kind === "on" ? "onyomi" : kind === "kun" ? "kunyomi" : "nanori",
    };
  });
}

export default function Cards() {
  const { ready, signedIn, cards, addCard, deleteCard } = useStore();
  const [form, setForm] = useState(empty);
  const frontRef = useRef<HTMLInputElement>(null);
  const readingRef = useRef<HTMLInputElement>(null);

  // A pasted 猫(ねこ) is split as you type, so the reading lands in its own field.
  const parsed = splitFuriganaNotation(form.front);
  const front = parsed.front;
  const reading = form.reading || parsed.reading || "";
  const readings = inferReadings(front, reading);
  const showReading = needsReading(front);
  const canSave = front !== "" && split(form.meaning).length > 0;

  function save() {
    if (!canSave) return;
    addCard({
      front,
      type: form.type || inferCardType(front),
      meanings: split(form.meaning),
      blacklist: split(form.blacklist),
      readings,
      readingType: form.readingType || undefined,
      altReadings: splitAltReadings(form.altReadings),
      mnemonic: form.mnemonic.trim() || undefined,
    });
    setForm(empty);
    frontRef.current?.focus();
  }

  if (ready && !signedIn) return <SignIn />;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Your cards</h1>
          <p className="mt-2 text-muted">
            Type the word and what it means. Everything else is worked out for you, or
            optional.
          </p>
        </div>

        {/* One centred column: the form is the thing you came here to use, so it
            gets the middle of the screen, with the deck listed beneath it. */}
        <div className="mt-8 flex flex-col gap-10">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <label className="block text-xs font-semibold text-muted">Japanese</label>
            <input
              ref={frontRef}
              autoFocus
              value={form.front}
              onChange={(e) => setForm({ ...form, front: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="猫 or 猫(ねこ)"
              className="jp mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-2xl outline-none focus:border-primary"
            />

            <label className="mt-4 block text-xs font-semibold text-muted">Meaning</label>
            <input
              value={form.meaning}
              onChange={(e) => setForm({ ...form, meaning: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="cat"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-muted">
              Separate alternatives with commas — any of them will be accepted.
            </p>

            {/* Only asked for when the word actually hides one. */}
            {showReading && (
              <>
                <label className="mt-4 block text-xs font-semibold text-muted">
                  Reading <span className="font-normal">(optional)</span>
                </label>
                <input
                  ref={readingRef}
                  value={reading}
                  onChange={(e) => setForm({ ...form, reading: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  onFocus={(e) => bind(e.currentTarget, { IMEMode: true })}
                  onBlur={(e) => {
                    try {
                      unbind(e.currentTarget);
                    } catch {
                      /* already unbound */
                    }
                  }}
                  placeholder="ねこ — romaji becomes kana"
                  className="jp mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Leave blank to be quizzed on the meaning only.
                </p>
              </>
            )}

            <details className="group mt-5">
              <summary className="cursor-pointer list-none text-xs font-semibold text-muted hover:text-foreground">
                <span className="inline-block transition-transform group-open:rotate-90">
                  ▸
                </span>{" "}
                More options
              </summary>

              <div className="mt-3 border-t border-border pt-3">
                <label className="block text-xs font-semibold text-muted">Type</label>
                <div className="mt-1 flex gap-1.5">
                  <button
                    onClick={() => setForm({ ...form, type: "" })}
                    className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                      form.type === "" ? "border-foreground" : "border-border text-muted"
                    }`}
                  >
                    auto
                  </button>
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                        form.type === t ? "border-foreground" : "border-border text-muted"
                      }`}
                    >
                      <span
                        className={`${TYPE_DOT[t]} mr-1 inline-block h-1.5 w-1.5 rounded-full`}
                      />
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>

                {showReading && (
                  <>
                    <label className="mt-4 block text-xs font-semibold text-muted">
                      Reading type
                    </label>
                    <div className="mt-1 flex gap-1.5">
                      {(["", "onyomi", "kunyomi", "nanori"] as const).map((t) => (
                        <button
                          key={t || "none"}
                          onClick={() => setForm({ ...form, readingType: t })}
                          className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                            form.readingType === t
                              ? "border-foreground"
                              : "border-border text-muted"
                          }`}
                        >
                          {t ? READING_TYPE_LABEL[t] : "unset"}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      Named in the prompt, so you know which reading is wanted.
                    </p>
                  </>
                )}

                {[
                  {
                    key: "altReadings",
                    label: "Other readings",
                    hint: "real, but not what we're testing → retry. Type in brackets: にん (on), ひと (kun)",
                    ph: "にん (on), ひと (kun)",
                    jp: true,
                  },
                  {
                    key: "blacklist",
                    label: "Blacklist",
                    hint: "rejected even if it nearly matches",
                    ph: "kitten",
                    jp: false,
                  },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="mt-4 block text-xs font-semibold text-muted">
                      {f.label}
                    </label>
                    <input
                      value={form[f.key as "altReadings" | "blacklist"]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.ph}
                      className={`${f.jp ? "jp" : ""} mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary`}
                    />
                    <p className="mt-1 text-[11px] text-muted">{f.hint}</p>
                  </div>
                ))}

                <label className="mt-4 block text-xs font-semibold text-muted">
                  Mnemonic
                </label>
                <textarea
                  value={form.mnemonic}
                  onChange={(e) => setForm({ ...form, mnemonic: e.target.value })}
                  rows={3}
                  placeholder="A story that hooks the meaning and the reading together."
                  className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            </details>

            <button
              onClick={save}
              disabled={!canSave}
              className="mt-5 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
            >
              Add card <span className="opacity-60">(Enter)</span>
            </button>
            <p className="mt-2 h-4 text-center text-[11px] text-muted">
              {describeCard(front, readings)}
            </p>
          </div>

          <div>
            {!ready ? (
              <p className="text-muted">Loading…</p>
            ) : (
              <ul className="space-y-3">
                {cards.map((c) => (
                  <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-start gap-4">
                      <span className="jp w-14 shrink-0 text-3xl">{c.front}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{c.meanings.join(", ")}</p>
                        {c.readings.length > 0 && (
                          <div className="mt-0.5 flex items-center gap-2">
                            <p className="jp text-sm text-muted">
                              {c.readings.join("、")}
                              {c.readingType && (
                                <span className="opacity-60">
                                  {" "}
                                  ({READING_TYPE_LABEL[c.readingType]})
                                </span>
                              )}
                              {c.altReadings.length > 0 && (
                                <span className="opacity-60">
                                  {" "}
                                  · also {c.altReadings.map((a) => a.reading).join("、")}
                                </span>
                              )}
                            </p>
                            <PronounceButton card={c} className="h-6 w-6" />
                          </div>
                        )}
                        {c.blacklist.length > 0 && (
                          <p className="mt-1 text-xs text-incorrect">
                            rejects: {c.blacklist.join(", ")}
                          </p>
                        )}
                        {c.mnemonic && <p className="mt-2 text-sm text-muted">{c.mnemonic}</p>}
                        <p className="mt-2 text-[11px] text-muted">
                          {tasksFor(c).length} question{tasksFor(c).length > 1 ? "s" : ""} ·{" "}
                          {TYPE_LABEL[c.type]}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteCard(c.id)}
                        className="shrink-0 text-xs text-muted hover:text-incorrect"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
