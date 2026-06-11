import { usePlayback } from "../../hooks/use-playback.js";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { clamp01, fmtTime } from "../../lib/format.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { RegionHandles } from "./region-handles.js";
import { Ruler } from "./ruler.js";
import { useScrubSurface } from "./use-scrub-surface.js";

/** Progress-mode scrubber: ruler + seekable track + loop region. */
export function Scrubber({
  showRuler = true,
  className,
}: { showRuler?: boolean; className?: string }) {
  const store = useStudio();
  const { frame, total, fps, durSec } = usePlayback();
  const region = useSignalValue(store.region);
  const s = useScrubSurface(total);
  const pct = clamp01(frame / s.den);
  const inFrac = clamp01(s.inFrame / s.den);
  const outFrac = clamp01(s.outFrame / s.den);
  const regionActive = region.in != null || region.out != null;

  return (
    <div className={cn("relative", className)}>
      {showRuler && (
        <div className="h-[18px] relative">
          <Ruler durSec={durSec} fps={fps} total={total} />
        </div>
      )}
      <div
        ref={s.ref}
        className="relative h-[26px] flex items-center cursor-pointer group"
        onMouseDown={(e) => {
          s.setDrag("seek");
          s.seekTo(e.clientX);
        }}
        onMouseMove={(e) => s.setHover(s.frac(e.clientX))}
        onMouseLeave={() => s.setHover(null)}
      >
        <div className="relative w-full h-[5px] rounded-full bg-white/13 group-hover:h-[7px] transition-[height]">
          {s.hover != null && (
            <div
              className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
              style={{ width: `${s.hover * 100}%` }}
            />
          )}
          <div
            className="absolute inset-y-0 left-0 bg-accent rounded-full z-[2]"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <RegionHandles
          inFrac={inFrac}
          outFrac={outFrac}
          active={regionActive}
          onStart={(w) => s.setDrag(w)}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-[14px] rounded-full bg-accent-2 shadow-[0_0_0_1px_rgba(0,0,0,.35),0_1px_5px_rgba(0,0,0,.5)] z-[6] pointer-events-none"
          style={{ left: `${pct * 100}%` }}
        />
        {s.hover != null && !s.drag && (
          <div
            className="absolute bottom-[26px] -translate-x-1/2 bg-black border border-line-2 font-mono text-[11px] text-white px-1.5 py-0.5 rounded-[5px] pointer-events-none z-[7]"
            style={{ left: `${s.hover * 100}%` }}
          >
            {fmtTime(s.hover * durSec)}
          </div>
        )}
      </div>
    </div>
  );
}
