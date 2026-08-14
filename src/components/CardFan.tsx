/**
 * Sample cards for the landing hero. Not the seed deck: these are here to be
 * looked at, so they're the three card types side by side, each with a short
 * enough meaning to fit a 13rem card. Colours and labels are spelled out rather
 * than imported from QuizPanel — three strings is cheaper than pulling the quiz
 * (and wanakana with it) into the signed-out bundle.
 */
const SAMPLES = [
  {
    front: "一",
    bg: "bg-component",
    label: "Component",
    meaning: "one",
    reading: "いち",
    /** transform, applied on top of the centring translate */
    tilt: "translate(-5.6rem, 1.4rem) rotate(-13deg)",
    z: "z-0",
  },
  {
    front: "火山",
    bg: "bg-compound",
    label: "Compound",
    meaning: "volcano",
    reading: "かざん",
    tilt: "translate(5.6rem, 1.1rem) rotate(12deg)",
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
    tilt: "rotate(-2deg)",
    z: "z-20",
  },
];

/**
 * A fanned hand of specimen cards — decorative only, so it's hidden from
 * assistive tech and never takes a click away from the sign-in form behind it.
 */
export default function CardFan() {
  return (
    <div aria-hidden className="pointer-events-none relative h-80 w-96 select-none">
      {SAMPLES.map((s) => (
        <div
          key={s.front}
          style={{ transform: `translate(-50%, -50%) ${s.tilt}` }}
          className={`${s.z} absolute top-1/2 left-1/2 w-52 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl`}
        >
          <div className={`${s.bg} px-4 py-6 text-center text-white`}>
            <p className="jp text-5xl leading-none font-medium">{s.front}</p>
            <p className="mt-3 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-80">
              {s.label} · Meaning
            </p>
          </div>
          <div className="p-3">
            {/* The answer bar, mid-typing — the part of the app you spend your
                time in, and the one thing a static screenshot can't show. */}
            <div className="rounded-lg border border-border bg-background px-3 py-2 text-center text-sm">
              {s.meaning}
              <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground" />
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-[11px]">
              <span className="text-muted">Reading</span>
              <span className="jp font-medium">{s.reading}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
