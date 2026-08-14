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

const SHARD_COLOURS = ["bg-component", "bg-primary", "bg-compound", "bg-accent"];

/**
 * Confetti thrown by the deal, as (direction, distance, spin) — resolved to a
 * vector here rather than in the markup. Every shard leaves from the middle of
 * the fan, which is where the cards were a moment earlier.
 */
const CONFETTI = [
  { deg: -104, dist: 240, spin: 320, size: "h-4 w-2" },
  { deg: -68, dist: 250, spin: -260, size: "h-2.5 w-2.5" },
  { deg: -32, dist: 280, spin: 400, size: "h-3 w-2" },
  { deg: -8, dist: 300, spin: -180, size: "h-2 w-2" },
  { deg: 22, dist: 285, spin: 300, size: "h-4 w-2" },
  { deg: 58, dist: 250, spin: -340, size: "h-2.5 w-2.5" },
  { deg: 96, dist: 245, spin: 240, size: "h-3 w-2" },
  { deg: 132, dist: 225, spin: -400, size: "h-2 w-2" },
  { deg: 158, dist: 205, spin: 360, size: "h-4 w-2" },
  // The three heading left stay shortest: that's the side the paragraph is on.
  { deg: -178, dist: 200, spin: -220, size: "h-2.5 w-2.5" },
  { deg: -146, dist: 215, spin: 420, size: "h-3 w-2" },
  { deg: -122, dist: 235, spin: -300, size: "h-2 w-2" },
].map((c, i) => ({
  ...c,
  x: `${Math.round(Math.cos((c.deg * Math.PI) / 180) * c.dist)}px`,
  y: `${Math.round(Math.sin((c.deg * Math.PI) / 180) * c.dist)}px`,
  colour: SHARD_COLOURS[i % SHARD_COLOURS.length],
  // Fired as the cards land, not before: 0.18s stagger + 0.7s of dealing.
  delay: `${0.5 + (i % 4) * 0.06}s`,
}));

/** Sparkles, placed around the silhouette of the fan rather than on it. */
const SPARKLES = [
  { left: "3%", top: "26%", size: "h-4 w-4", colour: "text-component", time: "3.4s", delay: "1.4s" },
  { left: "16%", top: "4%", size: "h-3 w-3", colour: "text-accent", time: "4.2s", delay: "2.1s" },
  { left: "47%", top: "-3%", size: "h-5 w-5", colour: "text-primary", time: "3.8s", delay: "1.7s" },
  { left: "91%", top: "13%", size: "h-3 w-3", colour: "text-compound", time: "4.6s", delay: "2.6s" },
  { left: "97%", top: "58%", size: "h-4 w-4", colour: "text-accent", time: "3.6s", delay: "3.2s" },
  { left: "80%", top: "94%", size: "h-3 w-3", colour: "text-primary", time: "4.4s", delay: "2.4s" },
  { left: "28%", top: "97%", size: "h-4 w-4", colour: "text-component", time: "4s", delay: "3.6s" },
  { left: "-2%", top: "71%", size: "h-3 w-3", colour: "text-compound", time: "5s", delay: "1.9s" },
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

      {CONFETTI.map((c, i) => (
        <span
          key={i}
          style={
            {
              "--burst-x": c.x,
              "--burst-y": c.y,
              "--burst-spin": `${c.spin}deg`,
              "--burst-delay": c.delay,
            } as CSSProperties
          }
          className={`${c.colour} ${c.size} animate-burst absolute top-1/2 left-1/2 z-30 rounded-xs`}
        />
      ))}

      {SPARKLES.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          fill="currentColor"
          style={
            {
              left: s.left,
              top: s.top,
              "--twinkle-time": s.time,
              "--twinkle-delay": s.delay,
            } as CSSProperties
          }
          className={`${s.colour} ${s.size} animate-twinkle absolute z-30`}
        >
          <path d="M12 0c1.1 8.2 2.7 9.8 12 12-9.3 2.2-10.9 3.8-12 12-1.1-8.2-2.7-9.8-12-12 9.3-2.2 10.9-3.8 12-12Z" />
        </svg>
      ))}
    </div>
  );
}
