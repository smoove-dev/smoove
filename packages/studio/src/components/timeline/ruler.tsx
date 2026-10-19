import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import { clamp01, fmtTime } from "../../lib/format.js";

type Tick = { at: number; label?: string; major: boolean };

/** Label steps to choose from, in seconds. */
const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
/** The least room a label needs, in pixels ("0:00" in the ruler's mono font, plus air). */
const MIN_LABEL_PX = 44;
/** How far a label reaches right of its tick; a tick closer than this to the end goes unlabeled. */
const LABEL_PX = 30;

/**
 * The smallest step whose labels sit at least {@link MIN_LABEL_PX} apart at
 * this width. Without a width yet, the old rule: 2 s past 9 s, else 1 s.
 */
export function labelStep(durSec: number, widthPx: number): number {
  if (widthPx <= 0 || durSec <= 0) return durSec > 9 ? 2 : 1;
  const pxPerSec = widthPx / durSec;
  return STEPS.find((s) => s * pxPerSec >= MIN_LABEL_PX) ?? (STEPS.at(-1) as number);
}

function rulerTicks(durSec: number, fps: number, total: number, step: number): Tick[] {
  const ticks: Tick[] = [];
  for (let s = 0; s <= durSec + 0.001; s += step) {
    ticks.push({ at: clamp01((s * fps) / total), label: fmtTime(s), major: true });
    if (s + step / 2 <= durSec) {
      ticks.push({ at: clamp01(((s + step / 2) * fps) / total), major: false });
    }
  }
  return ticks;
}

/** Time ruler: labeled major ticks per step, minor tick between. The step follows the width. */
export function Ruler({ durSec, fps, total }: { durSec: number; fps: number; total: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const step = labelStep(durSec, width);
  return (
    <div ref={ref} className="relative h-full">
      {rulerTicks(durSec, fps, total, step).map((t, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional
          key={i}
          className={cn("absolute top-0 bottom-0 w-px", t.major ? "bg-line-2" : "bg-line")}
          style={{ left: `${t.at * 100}%` }}
        >
          {t.major && (width <= 0 || t.at * width + LABEL_PX <= width) && (
            <span className="absolute top-[3px] left-1 font-mono text-[9.5px] text-ink-3 whitespace-nowrap">
              {t.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
