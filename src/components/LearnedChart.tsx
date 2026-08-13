"use client";

import { useState } from "react";
import Tooltip, { dayLabel, tipAt, type Tip } from "./Tooltip";
import { ACTIVITY_DAYS, dailyStats, type DayStat } from "@/lib/stats";
import type { ReviewLogEntry } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Cumulative items learned, over the same window as the heatmap beside it.
 *
 * The two answer different questions on purpose: the heatmap is how hard you
 * worked on a given day, this is how much you know. Effort can be flat while
 * this still climbs, and a plateau here with a busy heatmap means the reviews
 * are keeping you busy without adding anything new.
 *
 * Drawn in a 0–100 viewBox so every coordinate is already a percentage and the
 * chart resizes without measuring anything. `preserveAspectRatio="none"` lets
 * that square grid stretch to whatever box it lands in; `vectorEffect` keeps
 * the stroke from stretching with it.
 */
/** Never plot less than this, so a new deck still gets a readable axis. */
const MIN_SPAN = 30;

/**
 * Drop the dead space before the first item was ever learned.
 *
 * The heatmap's fixed half-year is right for it — empty squares are themselves
 * information — but on a curve those months are a flat line at zero that says
 * nothing and squeezes the part that does. A few days of run-up are kept so the
 * first climb starts from a visible baseline rather than the left edge.
 */
function sinceFirstItem(days: DayStat[]): DayStat[] {
  const first = days.findIndex((d) => d.total > 0);
  if (first < 0) return days.slice(-MIN_SPAN);
  return days.slice(Math.min(Math.max(0, first - 3), days.length - MIN_SPAN));
}

export default function LearnedChart({ log }: { log: ReviewLogEntry[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const days = sinceFirstItem(dailyStats(log, ACTIVITY_DAYS));
  // Monotonic, so the last point is the peak. The floor of 1 keeps an empty
  // log from dividing by zero and flattens it onto the baseline instead.
  const peak = Math.max(1, days[days.length - 1].total);

  const x = (i: number) => (i / (days.length - 1)) * 100;
  const y = (v: number) => 100 - (v / peak) * 100;

  const line = days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.total)}`).join(" ");
  // Same path, closed along the baseline, for the wash underneath it.
  const area = `${line} L100,100 L0,100 Z`;

  function track(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const share = (e.clientX - rect.left) / rect.width;
    const i = Math.min(days.length - 1, Math.max(0, Math.round(share * (days.length - 1))));
    const day = days[i];
    setHover(i);
    setTip(
      tipAt(rect.left + (x(i) / 100) * rect.width, rect.top + (y(day.total) / 100) * rect.height, dayLabel(day.date), [
        `${day.total} item${day.total === 1 ? "" : "s"} learned`,
        day.learned > 0 ? `+${day.learned} new that day` : "nothing new that day",
      ]),
    );
  }

  function clear() {
    setHover(null);
    setTip(null);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-muted">Items learned</p>
        <p className="text-xs text-muted">{days[days.length - 1].total} total</p>
      </div>

      <div className="mt-3 flex gap-2">
        {/* Only the two ends are labelled — a cumulative curve is read as a
            shape, and intermediate ticks would just crowd a panel this size. */}
        <div className="flex w-8 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] leading-none text-muted">
          <span>{peak}</span>
          <span>0</span>
        </div>

        <div
          // No padding here: the marker is positioned as a percentage of this
          // box, so any inset would slide it off the line it's marking.
          className="relative h-28 flex-1"
          onMouseMove={track}
          onMouseLeave={clear}
          onTouchStart={clear}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            aria-label={`Items learned over the last ${ACTIVITY_DAYS} days`}
          >
            {[0, 50, 100].map((g) => (
              <line
                key={g}
                x1="0"
                x2="100"
                y1={g}
                y2={g}
                className="stroke-border"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} className="fill-accent/15" />
            <path
              d={line}
              fill="none"
              className="stroke-accent"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1="0"
                y2="100"
                className="stroke-accent/50"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* The marker is HTML rather than an SVG circle: the stretched
              viewBox would squash a circle into an ellipse. */}
          {hover !== null && (
            <div
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-accent"
              style={{ left: `${x(hover)}%`, top: `${y(days[hover].total)}%` }}
            />
          )}
        </div>
      </div>

      {/* Ticks on the same 0–100 scale as the plot: the window's start date,
          then each month it crosses. A trimmed window may cross none, which is
          why the start is labelled outright rather than left implied. */}
      <div className="relative mt-1.5 ml-10 h-3">
        {days.map((day, i) => {
          if (i > 0) {
            const prev = days[i - 1];
            if (prev.date.getMonth() === day.date.getMonth()) return null;
            // Too close to either end to sit beside its neighbour.
            if (i < days.length * 0.1 || i > days.length - 8) return null;
          }
          return (
            <span
              key={day.key}
              className="absolute text-[9px] leading-none text-muted"
              style={{ left: `${x(i)}%` }}
            >
              {i === 0
                ? `${MONTHS[day.date.getMonth()]} ${day.date.getDate()}`
                : MONTHS[day.date.getMonth()]}
            </span>
          );
        })}
      </div>

      <Tooltip tip={tip} />
    </div>
  );
}
