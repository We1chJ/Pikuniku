import type { CSSProperties } from "react";

/**
 * Sample cards for the landing hero. Not the seed deck: these are here to be
 * looked at, so they're the three card types side by side, each with a short
 * enough meaning to fit a 14rem card. Colours and labels are spelled out rather
 * than imported from QuizPanel — a handful of strings is cheaper than pulling
 * the quiz (and wanakana with it) into the signed-out bundle.
 *
 * `tilt` places the card in the fan; `from` is roughly its inverse, so the deal
 * animation starts every card on the same spot in the middle of the fan.
 */
const SAMPLES = [
  {
    front: "一",
    bg: "bg-component",
    label: "Component",
    meaning: "one",
    reading: "いち",
    stage: "Master",
    stageCls: "bg-stage-master",
    due: "in 3w",
    tilt: "translate(-5rem, 1.4rem) rotate(-10deg)",
    from: "translate(5rem, -1.4rem) rotate(10deg)",
    deal: "0s",
    drift: { time: "7s", delay: "0.9s" },
    z: "z-0",
  },
  {
    front: "火山",
    bg: "bg-compound",
    label: "Compound",
    meaning: "volcano",
    reading: "かざん",
    stage: "Apprentice",
    stageCls: "bg-stage-apprentice",
    due: "in 4h",
    tilt: "translate(5rem, 1.1rem) rotate(11deg)",
    from: "translate(-5rem, -1.1rem) rotate(-11deg)",
    deal: "0.09s",
    drift: { time: "8.5s", delay: "1.05s" },
    z: "z-10",
  },
  {
    // Not 山: the card behind is 火山, and the front card covers its 火 — two
    // identical glyphs side by side looked like a rendering bug.
    front: "人",
    bg: "bg-primary",
    label: "Character",
    meaning: "person",
    reading: "じん",
    stage: "Guru",
    stageCls: "bg-stage-guru",
    due: "in 2d",
    tilt: "rotate(-2deg)",
    from: "rotate(2deg)",
    // Dealt last, so the card you're meant to read lands on top of the pile.
    deal: "0.18s",
    drift: { time: "6.5s", delay: "1.2s" },
    z: "z-20",
  },
];

/**
 * A fanned hand of specimen cards — decorative only, so it's hidden from
 * assistive tech and never takes a click away from the sign-in form behind it.
 */
export default function CardFan() {
  return (
    <div aria-hidden className="pointer-events-none relative h-96 w-96 select-none">
      {SAMPLES.map((s) => (
        <div
          key={s.front}
          style={{ transform: `translate(-50%, -50%) ${s.tilt}` }}
          className={`${s.z} absolute top-1/2 left-1/2 w-52`}
        >
          <div
            className="animate-deal"
            style={{ "--deal-from": s.from, "--deal-delay": s.deal } as CSSProperties}
          >
            <div
              style={
                {
                  "--drift-time": s.drift.time,
                  "--drift-delay": s.drift.delay,
                } as CSSProperties
              }
              className="animate-drift overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            >
              <div className={`${s.bg} px-4 py-9 text-center text-white`}>
                <p className="jp text-6xl leading-none font-medium">{s.front}</p>
                <p className="mt-4 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-80">
                  {s.label} · Meaning
                </p>
              </div>
              <div className="space-y-3 p-4">
                {/* The answer bar, mid-typing — the part of the app you spend
                    your time in, and the one thing a screenshot can't show. */}
                <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-center text-sm">
                  {s.meaning}
                  <span className="animate-caret ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground align-middle" />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Reading</span>
                  <span className="jp font-medium">{s.reading}</span>
                </div>
                <div className="flex items-center gap-2 border-t border-border pt-3">
                  <div className={`${s.stageCls} h-1.5 w-6 shrink-0 rounded-full`} />
                  <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                    {s.stage}
                  </span>
                  <span className="ml-auto text-[10px] text-muted">{s.due}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
