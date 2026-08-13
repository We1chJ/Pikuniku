"use client";

import Link from "next/link";
import Nav from "@/components/Nav";
import Landing from "@/components/Landing";
import Heatmap from "@/components/Heatmap";
import LearnedChart from "@/components/LearnedChart";
import { useStore, tasksFor } from "@/lib/store";
import { currentStreak, dailyBudget } from "@/lib/stats";
import { STAGES, STAGE_CLASS, stageOf, isDue, untilDue, type Stage } from "@/lib/scheduler";

/** Anki's default is 8; a smaller number surfaces problems sooner in a small deck. */
const LEECH_LAPSES = 4;

export default function Dashboard() {
  const {
    ready,
    signedIn,
    email,
    remote,
    error,
    cards,
    progress,
    log,
    settings,
    setSetting,
    grantExtraLessons,
    signOut,
  } = useStore();

  if (!ready) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-20 text-muted">Loading…</main>
      </>
    );
  }

  // Signed out, this is the front door; signed in, it's the dashboard.
  if (!signedIn) return <Landing />;

  const now = new Date();
  const questions = cards.flatMap((c) =>
    tasksFor(c, settings.production).map((task) => ({ card: c, task, state: progress[c.id]?.tasks?.[task] })),
  );

  const reviews = questions.filter((q) => q.state && isDue(q.state, now));

  // Lessons shown is what's actually available today, not the whole backlog —
  // a number you can't act on is just discouraging.
  const budget = dailyBudget(settings, log, now);
  const unstarted = questions.filter((q) => !q.state).length;
  const lessonsAvailable = Math.min(unstarted, budget.remaining);
  const streak = currentStreak(log, now);

  const stageCounts = STAGES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<Stage, number>,
  );
  for (const q of questions) {
    const stage = stageOf(q.state);
    if (stage !== "Lesson") stageCounts[stage] += 1;
  }

  // Next 24 hours, bucketed by hour — which reads as clean bars precisely because
  // due times are truncated to the hour when they're scheduled.
  const forecast = Array.from({ length: 24 }, (_, h) => {
    const from = new Date(now.getTime() + h * 3_600_000);
    const to = new Date(from.getTime() + 3_600_000);
    const count = questions.filter((q) => {
      if (!q.state) return false;
      const due = new Date(q.state.due);
      return due >= from && due < to;
    }).length;
    return { hour: (now.getHours() + h + 1) % 24, count };
  });
  const peak = Math.max(1, ...forecast.map((f) => f.count));

  const leeches = cards.filter((c) =>
    tasksFor(c, settings.production).some((t) => (progress[c.id]?.tasks?.[t]?.lapses ?? 0) >= LEECH_LAPSES),
  );

  const scored = log.filter((l) => l.outcome !== "imprecise");
  const accuracy = scored.length
    ? Math.round((scored.filter((l) => l.outcome === "precise").length / scored.length) * 100)
    : null;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {error && (
          <p className="mb-6 rounded-xl border border-incorrect bg-surface p-4 text-sm text-incorrect">
            Couldn&rsquo;t reach Supabase: {error}. Answers you give now may not be saved.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/review"
            className="rounded-2xl bg-component p-7 text-white transition-transform hover:-translate-y-0.5"
          >
            <p className="text-sm font-semibold tracking-[0.2em] uppercase opacity-85">
              Lessons
            </p>
            <p className="mt-2 text-6xl font-bold">{lessonsAvailable}</p>
            <p className="mt-2 text-sm opacity-85">
              {budget.remaining === 0
                ? `Daily limit reached — ${unstarted} waiting`
                : `${budget.started}/${budget.allowance} started today`}
            </p>
          </Link>
          <Link
            href="/review"
            className="rounded-2xl bg-primary p-7 text-white transition-transform hover:-translate-y-0.5"
          >
            <p className="text-sm font-semibold tracking-[0.2em] uppercase opacity-85">
              Reviews
            </p>
            <p className="mt-2 text-6xl font-bold">{reviews.length}</p>
            <p className="mt-2 text-sm opacity-85">Due right now</p>
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-bold tracking-wide uppercase">Progress</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STAGES.map((s) => (
              <div key={s} className="rounded-xl border border-border bg-surface p-4">
                <div className={`${STAGE_CLASS[s]} mb-3 h-1.5 w-8 rounded-full`} />
                <p className="text-3xl font-bold">{stageCounts[s]}</p>
                <p className="mt-1 text-xs text-muted">{s}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pacing sits with the counts it governs, not buried in settings. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="text-muted">New items per day</span>
          <input
            type="number"
            min={0}
            max={200}
            value={settings.dailyLessons}
            onChange={(e) =>
              setSetting("dailyLessons", Math.max(0, Number(e.target.value) || 0))
            }
            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center outline-none focus:border-primary"
          />
          <span className="flex-1 text-xs text-muted">
            Reviews are never capped — only new material is.
          </span>
          {unstarted > 0 && (
            <button
              onClick={() => grantExtraLessons(5)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-component hover:text-component"
            >
              {budget.remaining === 0 ? "Learn 5 more today" : "+5 today"}
            </button>
          )}
        </div>

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold tracking-wide uppercase">Activity</h2>
            <p className="text-xs text-muted">
              {streak > 0 ? `${streak}-day streak` : "No streak yet"} · {log.length} answers
            </p>
          </div>
          {/* Effort on the left, progress on the right. The heatmap takes its
              natural width — 26 fixed-width weeks — and the curve takes the rest. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-surface p-4">
              <Heatmap log={log} />
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <LearnedChart log={log} />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-bold tracking-wide uppercase">Next 24 hours</h2>
          <div className="mt-4 flex h-28 items-end gap-1 rounded-xl border border-border bg-surface p-4">
            {forecast.map((f, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-sm bg-accent"
                  style={{ height: `${(f.count / peak) * 100}%`, minHeight: f.count ? 4 : 1 }}
                  title={`${f.count} at ${f.hour}:00`}
                />
                {i % 6 === 0 && <span className="text-[10px] text-muted">{f.hour}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-bold tracking-wide uppercase">Accuracy</h2>
            <p className="mt-3 text-4xl font-bold">
              {accuracy === null ? "—" : `${accuracy}%`}
            </p>
            <p className="mt-1 text-xs text-muted">
              {log.length} answers recorded. Typo-forgiven answers are excluded.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-bold tracking-wide uppercase">Leeches</h2>
            {leeches.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nothing stuck yet. Cards failed {LEECH_LAPSES}+ times show up here — usually
                because the card needs editing, not more drilling.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {leeches.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span className="jp text-xl">{c.front}</span>
                    <Link href="/cards" className="text-xs font-semibold text-primary">
                      Edit this card →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-bold tracking-wide uppercase">All cards</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
            {cards.map((c) => {
              const tasks = tasksFor(c, settings.production);
              const states = tasks.map((t) => progress[c.id]?.tasks?.[t]);
              // A card is only as done as its least-studied task, so the row
              // reports the whole card: anything unstarted is a lesson and says
              // so, and only once they're all started does a due time — the
              // soonest of them — mean the card is waiting on a review.
              const unstarted = states.filter((s) => !s).length;
              const soonest = states
                .filter((s) => !!s)
                .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0];

              return (
                <div
                  key={c.id}
                  className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
                >
                  <span className="jp w-12 shrink-0 text-2xl">{c.front}</span>
                  <span className="flex-1 truncate text-sm">{c.meanings[0]}</span>
                  {tasks.map((t, i) => (
                    <span
                      key={t}
                      className={`${STAGE_CLASS[stageOf(states[i])]} rounded-full px-2 py-0.5 text-[10px] font-semibold text-white`}
                      title={`${t}: ${untilDue(states[i])}`}
                    >
                      {t === "meaning" ? "M" : t === "reading" ? "R" : "P"}
                    </span>
                  ))}
                  <span className="w-24 shrink-0 text-right text-xs text-muted">
                    {unstarted > 0 ? `${unstarted} to learn` : untilDue(soonest)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-bold tracking-wide uppercase">Settings</h2>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-5">
            <input
              type="checkbox"
              checked={settings.production}
              onChange={(e) => setSetting("production", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="text-sm font-semibold">Also test English → Japanese</span>
              <span className="mt-1 block text-xs text-muted">
                Adds a third question to cards that have a reading: you&rsquo;re shown the
                meaning and produce the word. Harder than recognition, and it grows your
                daily review count by roughly half. Answers count in kana — the characters
                are accepted too if you have a Japanese IME.
              </span>
            </span>
          </label>
        </section>

        {remote && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="text-xs text-muted">{email}</span>
            <button
              onClick={() => signOut()}
              className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        )}
      </main>
    </>
  );
}
