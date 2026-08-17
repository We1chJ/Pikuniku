"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import SignIn from "@/components/SignIn";
import CardForm from "@/components/CardForm";
import PronounceButton from "@/components/PronounceButton";
import { useStore, tasksFor } from "@/lib/store";
import { READING_TYPE_LABEL, TYPE_LABEL } from "@/lib/types";

export default function Cards() {
  const { ready, signedIn, cards, addCard, updateCard, deleteCard } = useStore();
  // Which card is open for correction. One at a time: the form is big enough
  // that two of them open at once would be a wall.
  const [editing, setEditing] = useState<string | null>(null);

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
          <CardForm autoFocus onSave={addCard} />

          <div>
            {!ready ? (
              <p className="text-muted">Loading…</p>
            ) : (
              <ul className="space-y-3">
                {cards.map((c) =>
                  editing === c.id ? (
                    // Replaces the row rather than sitting under it, so the card
                    // you're correcting doesn't appear twice saying two things.
                    <li key={c.id}>
                      <CardForm
                        card={c}
                        autoFocus
                        onSave={(fields) => {
                          updateCard(c.id, fields);
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </li>
                  ) : (
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
                          {c.mnemonic && (
                            <p className="mt-2 text-sm text-muted">{c.mnemonic}</p>
                          )}
                          <p className="mt-2 text-[11px] text-muted">
                            {tasksFor(c).length} question{tasksFor(c).length > 1 ? "s" : ""} ·{" "}
                            {TYPE_LABEL[c.type]}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <button
                            onClick={() => setEditing(c.id)}
                            className="text-xs text-muted hover:text-primary"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCard(c.id)}
                            className="text-xs text-muted hover:text-incorrect"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
