"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { bind, unbind } from "wanakana";
import {
  describeCard,
  inferCardType,
  inferReadings,
  needsReading,
  splitFuriganaNotation,
} from "@/lib/cardinfer";
import {
  READING_TYPE_LABEL,
  TYPE_LABEL,
  type AltReading,
  type Card,
  type CardType,
  type ReadingType,
} from "@/lib/types";

/**
 * The card form, in both of its moods: adding, and correcting.
 *
 * One component rather than two, because the interesting parts aren't the
 * inputs. Romaji becoming kana, 猫(ねこ) coming apart into two fields, a reading
 * being asked for only when the word hides one — that is the card's grammar, and
 * an edit form with its own copy of it would drift until a card could no longer
 * be corrected into the shape it was created in.
 */

const TYPES: CardType[] = ["component", "primary", "compound"];
const TYPE_DOT: Record<CardType, string> = {
  component: "bg-component",
  primary: "bg-primary",
  compound: "bg-compound",
};

/** What a card is made of, before the store gives it an identity. */
export type CardFields = Omit<Card, "id" | "createdAt">;

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

type Fields = typeof empty;

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

const ALT_SUFFIX: Record<ReadingType, string> = {
  onyomi: "on",
  kunyomi: "kun",
  nanori: "nanori",
};

/**
 * The inverse of the two functions above. An edit opens on what the card
 * actually says, so saving without touching anything has to leave it unchanged.
 */
function seed(card: Card): Fields {
  return {
    front: card.front,
    meaning: card.meanings.join(", "),
    reading: card.readings.join(", "),
    type: card.type,
    readingType: card.readingType ?? "",
    altReadings: card.altReadings
      .map((a) => (a.type ? `${a.reading} (${ALT_SUFFIX[a.type]})` : a.reading))
      .join(", "),
    blacklist: card.blacklist.join(", "),
    mnemonic: card.mnemonic ?? "",
  };
}

export default function CardForm({
  card,
  onSave,
  onCancel,
  autoFocus = false,
}: {
  /** The card being corrected. Omitted when adding a new one. */
  card?: Card;
  onSave: (fields: CardFields) => void;
  /** Edit mode only: adding has nothing to cancel back to. */
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const editing = card !== undefined;
  const [form, setForm] = useState<Fields>(() => (card ? seed(card) : empty));
  const frontRef = useRef<HTMLInputElement>(null);

  /**
   * Attach WanaKana to an input and keep React in step with it.
   *
   * WanaKana rewrites `input.value` directly. React's onChange never fires for
   * a value set from outside React, so a controlled input would immediately
   * overwrite the converted kana with its stale state — the characters appear
   * and vanish. Listening to the native input event instead catches every
   * change, whoever made it.
   *
   * A ref callback rather than an effect, because the reading field is
   * conditionally rendered and this way binding follows the element's life.
   */
  const kanaField = useCallback(
    (field: "front" | "reading") => (el: HTMLInputElement | null) => {
      if (!el) return;
      if (field === "front") frontRef.current = el;
      bind(el, { IMEMode: true });
      const sync = () => setForm((f) => ({ ...f, [field]: el.value }));
      el.addEventListener("input", sync);
      return () => {
        el.removeEventListener("input", sync);
        try {
          unbind(el);
        } catch {
          /* already unbound */
        }
      };
    },
    [],
  );

  const frontField = useMemo(() => kanaField("front"), [kanaField]);
  const readingField = useMemo(() => kanaField("reading"), [kanaField]);

  // A pasted 猫(ねこ) is split as you type, so the reading lands in its own field.
  const parsed = splitFuriganaNotation(form.front);
  const front = parsed.front;
  const reading = form.reading || parsed.reading || "";
  const readings = inferReadings(front, reading);
  const showReading = needsReading(front);
  const canSave = front !== "" && split(form.meaning).length > 0;

  function save() {
    if (!canSave) return;
    onSave({
      front,
      type: form.type || inferCardType(front),
      meanings: split(form.meaning),
      blacklist: split(form.blacklist),
      readings,
      readingType: form.readingType || undefined,
      altReadings: splitAltReadings(form.altReadings),
      mnemonic: form.mnemonic.trim() || undefined,
    });
    // Adding leaves the form ready for the next card; editing is finished, and
    // whoever opened it decides what happens to it.
    if (!editing) {
      setForm(empty);
      frontRef.current?.focus();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <label className="block text-xs font-semibold text-muted">Japanese</label>
      <input
        // Romaji becomes kana here too, so a kana word can be typed without
        // switching keyboards. Pasted kanji passes through untouched —
        // WanaKana only rewrites Latin characters.
        ref={frontField}
        autoFocus={autoFocus}
        value={form.front}
        onChange={() => {}}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="猫, ねこ, or 猫(ねこ)"
        className="jp mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-2xl outline-none focus:border-primary"
      />
      <p className="mt-1 text-[11px] text-muted">
        <code>neko</code> → ねこ, <code>NEKO</code> → ネコ. Capitals give katakana; pasted
        kanji is left alone.
      </p>

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
            ref={readingField}
            value={reading}
            onChange={() => {}}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="ねこ, or KO-HI- for コーヒー"
            className="jp mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted">
            Leave blank to be quizzed on the meaning only.
          </p>
        </>
      )}

      <details className="group mt-5" open={editing}>
        <summary className="cursor-pointer list-none text-xs font-semibold text-muted hover:text-foreground">
          <span className="inline-block transition-transform group-open:rotate-90">▸</span>{" "}
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
                      form.readingType === t ? "border-foreground" : "border-border text-muted"
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
              <label className="mt-4 block text-xs font-semibold text-muted">{f.label}</label>
              <input
                value={form[f.key as "altReadings" | "blacklist"]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.ph}
                className={`${f.jp ? "jp" : ""} mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary`}
              />
              <p className="mt-1 text-[11px] text-muted">{f.hint}</p>
            </div>
          ))}

          <label className="mt-4 block text-xs font-semibold text-muted">Mnemonic</label>
          <textarea
            value={form.mnemonic}
            onChange={(e) => setForm({ ...form, mnemonic: e.target.value })}
            rows={3}
            placeholder="A story that hooks the meaning and the reading together."
            className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </details>

      <div className="mt-5 flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          onClick={save}
          disabled={!canSave}
          className="flex-1 rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
        >
          {editing ? "Save changes" : "Add card"} <span className="opacity-60">(Enter)</span>
        </button>
      </div>
      <p className="mt-2 h-4 text-center text-[11px] text-muted">
        {describeCard(front, readings)}
      </p>
    </div>
  );
}
