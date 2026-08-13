"use client";

/**
 * The hover readout shared by both activity charts.
 *
 * Native `title` popups would be free, but they wait a second before appearing,
 * can't be styled, and only carry one line — which rules them out for a chart
 * where the whole point of hovering is to read the day's numbers quickly.
 *
 * Positioned `fixed` against viewport coordinates, so neither chart needs a
 * positioned ancestor and no scroll offset ever has to be corrected for.
 */
export interface Tip {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

/** Half the tooltip's width, near enough — used to keep it on screen. */
const MARGIN = 90;

/**
 * Build a tip anchored above (x, y) in viewport coordinates, nudged inward so a
 * hover at either edge — the newest column is right on the edge — stays legible.
 */
export function tipAt(x: number, y: number, title: string, lines: string[]): Tip {
  return {
    x: Math.min(Math.max(x, MARGIN), window.innerWidth - MARGIN),
    y,
    title,
    lines,
  };
}

/** "Sat, Aug 8" — the heading both charts put on a hovered day. */
export function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      // Never let it swallow the mouse: the pointer is over the chart, and a
      // tooltip that intercepts the move would flicker itself out of existence.
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-background px-3 py-2 shadow-lg"
      style={{ left: tip.x, top: tip.y - 10 }}
      role="tooltip"
    >
      <p className="text-xs font-semibold whitespace-nowrap">{tip.title}</p>
      {tip.lines.map((line) => (
        <p key={line} className="mt-0.5 text-xs whitespace-nowrap text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}
