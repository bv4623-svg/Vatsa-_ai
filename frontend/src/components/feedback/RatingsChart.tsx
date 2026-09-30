"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface DayRatings {
  date: string; // YYYY-MM-DD
  up: number;
  down: number;
}

// Diverging poles from the validated reference palette (blue = helpful,
// red = not helpful), stepped per theme; both pairs pass the colorblind
// and contrast checks on light and dark surfaces.
const UP = "fill-[#2a78d6] dark:fill-[#3987e5]";
const DOWN = "fill-[#e34948] dark:fill-[#e66767]";
const SWATCH_UP = "bg-[#2a78d6] dark:bg-[#3987e5]";
const SWATCH_DOWN = "bg-[#e34948] dark:bg-[#e66767]";

const W = 640;
const H = 240;
const PAD = { top: 14, right: 8, bottom: 26, left: 28 };
const PLOT_W = W - PAD.left - PAD.right;
const HALF = (H - PAD.top - PAD.bottom) / 2;
const BASE = PAD.top + HALF;

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A bar anchored at the baseline with only its far end rounded (4px). */
function barPath(x: number, w: number, h: number, dir: 1 | -1): string {
  const r = Math.min(4, w / 2, h);
  const tip = BASE - dir * h;
  if (dir === 1) {
    return `M${x},${BASE} V${tip + r} Q${x},${tip} ${x + r},${tip} H${x + w - r} Q${x + w},${tip} ${x + w},${tip + r} V${BASE} Z`;
  }
  return `M${x},${BASE} V${tip - r} Q${x},${tip} ${x + r},${tip} H${x + w - r} Q${x + w},${tip} ${x + w},${tip - r} V${BASE} Z`;
}

/** 👍 above / 👎 below a zero line, one column per day. */
export function RatingsChart({ days }: { days: DayRatings[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(1, ...days.map((d) => Math.max(d.up, d.down)));
  const slot = PLOT_W / Math.max(days.length, 1);
  const barW = Math.max(1, slot - 2); // 2px gap between days
  const scale = (v: number) => (v / peak) * (HALF - 2);
  const up = days.reduce((s, d) => s + d.up, 0);
  const down = days.reduce((s, d) => s + d.down, 0);
  const tickIdx = days.length > 2 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : days.map((_, i) => i);
  const hovered = hover === null ? null : days[hover];

  return (
    <figure className="rounded-xl border border-border/60 bg-card/50 p-4">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Ratings per day</span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", SWATCH_UP)} aria-hidden="true" />Helpful 👍</span>
          <span className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", SWATCH_DOWN)} aria-hidden="true" />Not helpful 👎</span>
        </span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Ratings per day over ${days.length} days: ${up} helpful, ${down} not helpful`}
          onMouseLeave={() => setHover(null)}
        >
          {/* recessive guides: zero line plus the peak above and below */}
          <line x1={PAD.left} x2={W - PAD.right} y1={BASE} y2={BASE} className="stroke-border" strokeWidth={1} />
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} className="stroke-border/40" strokeDasharray="2 4" />
          <line x1={PAD.left} x2={W - PAD.right} y1={BASE + HALF} y2={BASE + HALF} className="stroke-border/40" strokeDasharray="2 4" />
          <text x={PAD.left - 6} y={PAD.top + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{peak}</text>
          <text x={PAD.left - 6} y={BASE + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">0</text>
          <text x={PAD.left - 6} y={BASE + HALF + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{peak}</text>

          {days.map((d, i) => {
            const x = PAD.left + i * slot + 1;
            return (
              <g key={d.date}>
                {hover === i && <rect x={x - 1} y={PAD.top} width={slot} height={HALF * 2} className="fill-muted/60" />}
                {d.up > 0 && <path d={barPath(x, barW, scale(d.up), 1)} className={UP} />}
                {d.down > 0 && <path d={barPath(x, barW, scale(d.down), -1)} className={DOWN} />}
                {/* hit target: the whole day column, larger than the marks */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={HALF * 2}
                  fill="transparent"
                  data-testid="rating-day"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}

          {tickIdx.map((i) => (
            <text
              key={i}
              x={PAD.left + (i + 0.5) * slot}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-[10px]"
            >
              {shortDate(days[i].date)}
            </text>
          ))}
        </svg>

        {hovered && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{ left: `${((PAD.left + (hover + 0.5) * slot) / W) * 100}%` }}
          >
            <span className="font-medium">{shortDate(hovered.date)}</span> · {hovered.up} helpful · {hovered.down} not helpful
          </div>
        )}
      </div>

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 font-medium">Day</th>
              <th scope="col" className="py-1 text-right font-medium">Helpful</th>
              <th scope="col" className="py-1 text-right font-medium">Not helpful</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {days.filter((d) => d.up || d.down).map((d) => (
              <tr key={d.date} className="border-t border-border/40">
                <td className="py-1">{shortDate(d.date)}</td>
                <td className="py-1 text-right tabular-nums">{d.up}</td>
                <td className="py-1 text-right tabular-nums">{d.down}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
