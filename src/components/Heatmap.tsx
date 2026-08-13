"use client";

import { useState } from "react";
import Tooltip, { dayLabel, tipAt, type Tip } from "./Tooltip";
import { ACTIVITY_DAYS, dailyStats, type DayStat } from "@/lib/stats";
import type { ReviewLogEntry } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Four filled levels rather than a continuous scale: on a grid this small,
 * shades finer than this are indistinguishable.
 */
function level(count: number, busy: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const share = count / Math.max(busy, 1);
  if (share > 0.66) return 4;
  if (share > 0.33) return 3;
  if (share > 0.1) return 2;
  return 1;
}

const FILL: Record<number, string> = {
  0: "bg-border",
  1: "bg-accent/30",
  2: "bg-accent/55",
  3: "bg-accent/80",
  4: "bg-accent",
};

/** What a day's square says on hover. */
function summarize(day: DayStat): string[] {
  if (day.count === 0) return ["No reviews"];
  const accuracy =
    day.scored > 0 ? ` · ${Math.round((day.precise / day.scored) * 100)}%` : "";
  const lines = [`${day.count} answer${day.count === 1 ? "" : "s"}${accuracy}`];
  if (day.learned > 0) lines.push(`${day.learned} new item${day.learned === 1 ? "" : "s"}`);
  return lines;
}

export default function Heatmap({ log }: { log: ReviewLogEntry[] }) {
  const [tip, setTip] = useState<Tip | null>(null);

  const days = dailyStats(log, ACTIVITY_DAYS);
  const busiest = Math.max(...days.map((d) => d.count), 0);

  // Pad the front so the first column starts on a Sunday and every column is a
  // real week; without this the month labels drift out of alignment.
  const lead = days[0].date.getDay();
  const cells: (DayStat | null)[] = [...Array<null>(lead).fill(null), ...days];

  const columns: (DayStat | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  return (
    // The tooltip sits outside the scroller: `fixed` isn't clipped by overflow,
    // but keeping it out of the scrolling box is one less thing to get wrong.
    <>
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-xs font-semibold text-muted">Answers per day</p>
            <p className="text-xs text-muted">{busiest} on the busiest day</p>
          </div>

          {/* Month label sits above the column where that month first appears. */}
          <div className="mt-2 flex gap-[3px]">
            {columns.map((col, i) => {
              const first = col.find(Boolean);
              const prev = columns[i - 1]?.find(Boolean);
              const show =
                first && (!prev || prev.date.getMonth() !== first.date.getMonth());
              return (
                <div key={i} className="w-[11px] text-[9px] leading-none text-muted">
                  {show ? MONTHS[first.date.getMonth()] : ""}
                </div>
              );
            })}
          </div>

          <div className="flex gap-[3px]" onMouseLeave={() => setTip(null)}>
            {columns.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((day, j) =>
                  day === null ? (
                    <div key={j} className="h-[11px] w-[11px]" />
                  ) : (
                    <div
                      key={j}
                      // Anchored to the square rather than the cursor, so the
                      // readout holds still while you move along a week.
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setTip(
                          tipAt(r.left + r.width / 2, r.top, dayLabel(day.date), summarize(day)),
                        );
                      }}
                      className={`${FILL[level(day.count, busiest)]} h-[11px] w-[11px] rounded-[2px]`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <div key={l} className={`${FILL[l]} h-[11px] w-[11px] rounded-[2px]`} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      <Tooltip tip={tip} />
    </>
  );
}
