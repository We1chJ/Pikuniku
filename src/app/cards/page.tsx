"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import { useStore, tasksFor } from "@/lib/store";
import { TYPE_LABEL } from "@/components/QuizPanel";
import type { CardType } from "@/lib/types";

const TYPES: CardType[] = ["component", "primary", "compound"];
const TYPE_DOT: Record<CardType, string> = {
  component: "bg-component",
  primary: "bg-primary",
  compound: "bg-compound",
};

const empty = {
  front: "",
  type: "primary" as CardType,
  meanings: "",
  blacklist: "",
  readings: "",
  altReadings: "",
  mnemonic: "",
};

function split(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function Cards() {
  const { ready, cards, addCard, deleteCard } = useStore();
  const [form, setForm] = useState(empty);

  const canSave = form.front.trim() !== "" && split(form.meanings).length > 0;

  function save() {
    if (!canSave) return;
    addCard({
      front: form.front.trim(),
      type: form.type,
      meanings: split(form.meanings),
      blacklist: split(form.blacklist),
      readings: split(form.readings),
      altReadings: split(form.altReadings),
      mnemonic: form.mnemonic.trim() || undefined,
    });
    setForm(empty);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Your cards</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Everything the grader knows comes from these fields. Alternate meanings make it
          forgiving; blacklisted answers make it strict where it matters.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[22rem_1fr]">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-bold tracking-wide uppercase">New card</h2>

            <label className="mt-4 block text-xs font-semibold text-muted">Front</label>
            <input
              value={form.front}
              onChange={(e) => setForm({ ...form, front: e.target.value })}
              placeholder="猫"
              className="jp mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xl outline-none focus:border-primary"
            />

            <label className="mt-4 block text-xs font-semibold text-muted">Type</label>
            <div className="mt-1 flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                    form.type === t ? "border-foreground" : "border-border text-muted"
                  }`}
                >
                  <span className={`${TYPE_DOT[t]} mr-1.5 inline-block h-2 w-2 rounded-full`} />
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            {[
              { key: "meanings", label: "Meanings", hint: "comma separated; first is primary", ph: "cat" },
              { key: "readings", label: "Readings (kana)", hint: "leave empty to skip the reading question", ph: "ねこ" },
              { key: "altReadings", label: "Other readings", hint: "real, but not what we're testing → retry", ph: "びょう" },
              { key: "blacklist", label: "Blacklist", hint: "rejected even if it nearly matches", ph: "kitten" },
            ].map((f) => (
              <div key={f.key}>
                <label className="mt-4 block text-xs font-semibold text-muted">{f.label}</label>
                <input
                  value={form[f.key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.ph}
                  className={`${f.key.includes("eading") ? "jp" : ""} mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary`}
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

            <button
              onClick={save}
              disabled={!canSave}
              className="mt-5 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
            >
              Add card
            </button>
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
                          <p className="jp mt-0.5 text-sm text-muted">
                            {c.readings.join("、")}
                            {c.altReadings.length > 0 && (
                              <span className="opacity-60"> · also {c.altReadings.join("、")}</span>
                            )}
                          </p>
                        )}
                        {c.blacklist.length > 0 && (
                          <p className="mt-1 text-xs text-incorrect">
                            rejects: {c.blacklist.join(", ")}
                          </p>
                        )}
                        {c.mnemonic && (
                          <p className="mt-2 text-sm text-muted">{c.mnemonic}</p>
                        )}
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
