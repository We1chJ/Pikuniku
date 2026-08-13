"use client";

import { answersByDay, type DayCount } from "@/lib/stats";
import type { ReviewLogEntry } from "@/lib/types";

const WEEKS = 26;
const DAYS = WEEKS * 7;

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

export default function Heatmap({ log }: { log: ReviewLogEntry[] }) {
  const days = answersByDay(log, DAYS);
  const busiest = Math.max(...days.map((d) => d.count), 0);

  // Pad the front so the first column starts on a Sunday and every column is a
  // real week; without this the month labels drift out of alignment.
  const lead = days[0].date.getDay();
  const cells: (DayCount | null)[] = [...Array<null>(lead).fill(null), ...days];

  const columns: (DayCount | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full flex-col gap-1">
        {/* Month label sits above the column where that month first appears. */}
        <div className="flex gap-[3px]">
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

        <div className="flex gap-[3px]">
          {columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((day, j) =>
                day === null ? (
                  <div key={j} className="h-[11px] w-[11px]" />
                ) : (
                  <div
                    key={j}
                    title={`${day.count} answer${day.count === 1 ? "" : "s"} on ${day.key}`}
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
  );
}
