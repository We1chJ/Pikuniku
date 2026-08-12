"use client";

import DemoQuiz from "./DemoQuiz";
import SignInForm from "./SignInForm";

const LADDER = [
  { name: "Apprentice", cls: "bg-stage-apprentice", note: "hours" },
  { name: "Guru", cls: "bg-stage-guru", note: "days" },
  { name: "Master", cls: "bg-stage-master", note: "weeks" },
  { name: "Enlightened", cls: "bg-stage-enlightened", note: "months" },
  { name: "Burned", cls: "bg-stage-burned", note: "done" },
];

const PILLARS = [
  {
    accent: "text-component",
    title: "You type the answer",
    body: "No multiple choice, no flipping a card and grading yourself. Recall is the whole exercise, so the app makes you produce the answer before it shows you anything.",
  },
  {
    accent: "text-primary",
    title: "Typos are forgiven. Wrong answers aren't.",
    body: "Meanings are matched with an edit-distance tolerance that scales with word length. Readings are exact — a wrong kana is a wrong sound. And there's a third state between right and wrong for when you answered the wrong question.",
  },
  {
    accent: "text-compound",
    title: "Scheduling that adapts",
    body: "WaniKani's ladder is fixed for everyone. Pikuniku runs FSRS underneath, so intervals fit the card and your history — while keeping the stages, because watching something burn is the point.",
  },
];

/** The signed-out front door. Signed-in visitors never see this — they get the dashboard. */
export default function Landing() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] blur-3xl"
          style={{
            background:
              "radial-gradient(40rem 20rem at 15% 20%, #00aaff, transparent), radial-gradient(35rem 18rem at 80% 15%, #ff00aa, transparent), radial-gradient(30rem 20rem at 55% 90%, #aa00ff, transparent)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-24 sm:py-32">
          <p className="jp mb-6 text-sm font-semibold tracking-[0.35em] text-muted uppercase">
            ピクニク
          </p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-7xl">
            WaniKani&rsquo;s method.
            <br />
            <span className="text-primary">Your</span> flashcards.
          </h1>
          <p className="mt-7 max-w-xl text-lg text-muted">
            The teaching machinery that makes WaniKani work — the drilling, the forgiving
            grader, the stages — pointed at material you write yourself.
          </p>
          <div className="mt-10 max-w-sm">
            <SignInForm autoFocus />
            <p className="mt-3 text-xs text-muted">
              Your cards sync across every device you sign in on.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-10 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title}>
              <h2 className={`${p.accent} text-sm font-bold tracking-wide uppercase`}>
                {p.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight">
            Five stages, then it&rsquo;s yours
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Every card climbs the same ladder. Get it right and the gap widens; miss it and
            you drop back. Reach the end and it leaves your queue for good.
          </p>
          <ol className="mt-10 grid gap-3 sm:grid-cols-5">
            {LADDER.map((s, i) => (
              <li key={s.name} className="flex flex-col gap-2">
                <div className={`${s.cls} h-2 rounded-full`} />
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-muted">
                  {i + 1} · {s.note}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Try a review</h2>
        <p className="mt-3 text-muted">
          This is the real review screen and the real grader. Answer in English for a
          meaning, or type romaji for a reading and watch it become kana.
        </p>
        <div className="mt-8">
          <DemoQuiz />
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            When a card won&rsquo;t stick, the card is usually the problem
          </h2>
          <p className="mt-4 text-muted">
            In a deck you wrote yourself, an item you keep failing is rarely a memory
            failure. It&rsquo;s an ambiguous answer, a missing synonym, or two cards that
            should have been one. So Pikuniku flags those cards and takes you straight to
            editing them — the fix an app with a fixed curriculum can&rsquo;t offer you.
          </p>
          <div className="mt-8 max-w-sm">
            <SignInForm />
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-muted">
        Pikuniku is an independent project. Not affiliated with WaniKani or Tofugu.
      </footer>
    </main>
  );
}
