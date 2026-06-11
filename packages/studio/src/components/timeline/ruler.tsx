import { cn } from "../../lib/cn.js";
import { clamp01, fmtTime } from "../../lib/format.js";

type Tick = { at: number; label?: string; major: boolean };

function rulerTicks(durSec: number, fps: number, total: number): Tick[] {
  const ticks: Tick[] = [];
  const step = durSec > 9 ? 2 : 1;
  for (let s = 0; s <= durSec + 0.001; s += step) {
    ticks.push({ at: clamp01((s * fps) / total), label: fmtTime(s), major: true });
    if (s + step / 2 <= durSec) {
      ticks.push({ at: clamp01(((s + step / 2) * fps) / total), major: false });
    }
  }
  return ticks;
}

/** Time ruler: labeled major ticks per step, minor tick between. */
export function Ruler({ durSec, fps, total }: { durSec: number; fps: number; total: number }) {
  return (
    <div className="relative h-full">
      {rulerTicks(durSec, fps, total).map((t, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional
          key={i}
          className={cn("absolute top-0 bottom-0 w-px", t.major ? "bg-line-2" : "bg-line")}
          style={{ left: `${t.at * 100}%` }}
        >
          {t.major && (
            <span className="absolute top-[3px] left-1 font-mono text-[9.5px] text-ink-3 whitespace-nowrap">
              {t.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
