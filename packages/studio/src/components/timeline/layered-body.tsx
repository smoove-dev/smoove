import { useEffect, useMemo, useRef, useState } from "react";
import { useComposition } from "../../hooks/use-composition.js";
import { deriveLayers } from "../../hooks/use-layers.js";
import { usePlayback } from "../../hooks/use-playback.js";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { LAYER_KINDS } from "../../lib/constants.js";
import { clamp01 } from "../../lib/format.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { Icon } from "../icon/icon.js";
import { RegionHandles } from "./region-handles.js";
import { Ruler } from "./ruler.js";
import { useScrubSurface } from "./use-scrub-surface.js";

const ROW = 30;
const HEADER = 24;
const NAMES_W = 196;
const MAX_H = 210;
const EMPTY = new Set<number>();

/**
 * Layered timeline. One scroll container holds the names column and the track
 * lane side by side, so vertical scroll stays in sync. The ruler (top) and the
 * names column (left) are sticky; the playhead + loop region span the full track
 * height. Horizontal zoom widens the lane and scrolls horizontally.
 */
export function LayeredBody() {
  const store = useStudio();
  const { composition: comp, entry, selectedId } = useComposition();
  const { frame, total, fps, durSec } = usePlayback();
  const layerOffMap = useSignalValue(store.layerOff);
  const region = useSignalValue(store.region);
  const zoom = useSignalValue(store.timelineZoom);
  const off = layerOffMap[selectedId] ?? EMPTY;

  const layers = useMemo(() => entry?.layers ?? (comp ? deriveLayers(comp) : []), [entry, comp]);

  // Measure the lane viewport so zoom 1 = fit-width (no horizontal scroll).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportW, setViewportW] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth));
    ro.observe(el);
    setViewportW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const laneViewport = Math.max(0, viewportW - NAMES_W);
  const tracksW = Math.max(1, laneViewport * zoom);

  const s = useScrubSurface(total);
  const pct = clamp01(frame / s.den);
  const inFrac = clamp01(s.inFrame / s.den);
  const outFrac = clamp01(s.outFrame / s.den);
  const regionActive = region.in != null || region.out != null;
  const bodyH = layers.length * ROW;

  return (
    <div className="flex flex-col min-h-0 border-b border-line">
      <div ref={scrollRef} className="relative overflow-auto scroll" style={{ maxHeight: MAX_H }}>
        <div className="relative" style={{ width: NAMES_W + tracksW }}>
          {/* header: the whole row is sticky-top; the corner is also sticky-left */}
          <div className="flex sticky top-0 z-30" style={{ height: HEADER }}>
            <div
              className="sticky left-0 z-40 flex-none flex items-center gap-1.5 px-3 text-[10px] font-bold tracking-[.08em] uppercase text-ink-3 bg-bg-1 border-r border-b border-line"
              style={{ width: NAMES_W }}
            >
              Layers
              <span className="font-mono text-[10px] text-ink-3 bg-bg-2 border border-line rounded-full px-1.5 tracking-normal">
                {layers.length}
              </span>
            </div>
            <div className="relative bg-bg-1 border-b border-line" style={{ width: tracksW }}>
              <Ruler durSec={durSec} fps={fps} total={total} />
            </div>
          </div>

          {/* body: names column + track lane */}
          <div className="flex">
            {/* names (sticky left) */}
            <div
              className="sticky left-0 z-20 flex-none bg-bg-1 border-r border-line"
              style={{ width: NAMES_W }}
            >
              {layers.map((l, i) => {
                const kind = LAYER_KINDS[l.kind] ?? LAYER_KINDS.sequence;
                const disabled = off.has(i);
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: layers are positional tracks
                    key={i}
                    className={cn(
                      "flex items-center gap-2 px-2.5 border-b border-line",
                      disabled && "opacity-45",
                    )}
                    style={{ height: ROW }}
                  >
                    <button
                      type="button"
                      onClick={() => store.toggleLayer(i)}
                      className="size-[22px] grid place-items-center rounded-[5px] text-ink-2 hover:bg-bg-3 hover:text-ink-1 flex-none"
                      title={disabled ? "Enable" : "Disable"}
                    >
                      <Icon name={disabled ? "eyeOff" : "eye"} size={14} />
                    </button>
                    <span
                      className="size-2 rounded-sm flex-none"
                      style={{ background: kind.color }}
                    />
                    <span
                      className={cn(
                        "flex-1 min-w-0 truncate text-[12px] font-medium text-ink-1",
                        disabled && "line-through text-ink-3",
                      )}
                    >
                      {l.name}
                    </span>
                    <span className="text-ink-3">
                      <Icon name={kind.icon} size={12} />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* track lane (seek surface) */}
            <button
              ref={s.ref}
              className="relative cursor-pointer"
              style={{ width: tracksW, height: bodyH }}
              type="button"
              onMouseDown={(e) => {
                s.setDrag("seek");
                s.seekTo(e.clientX);
              }}
            >
              {regionActive && (
                <div
                  className="absolute top-0 bottom-0 bg-accent/13 border-x border-accent/55 pointer-events-none z-[1]"
                  style={{ left: `${inFrac * 100}%`, width: `${(outFrac - inFrac) * 100}%` }}
                />
              )}
              {layers.map((l, i) => {
                const kind = LAYER_KINDS[l.kind] ?? LAYER_KINDS.sequence;
                const disabled = off.has(i);
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: layers are positional tracks
                    key={i}
                    className={cn(
                      "relative border-b border-line",
                      i % 2 === 1 && "bg-white/[.012]",
                      disabled &&
                        "bg-[repeating-linear-gradient(45deg,transparent,transparent_7px,rgba(255,255,255,.02)_7px,rgba(255,255,255,.02)_14px)]",
                    )}
                    style={{ height: ROW }}
                  >
                    <div
                      className={cn(
                        "absolute top-1 bottom-1 rounded-[5px] min-w-[6px] flex items-center overflow-hidden z-[2] shadow-[0_1px_4px_rgba(0,0,0,.3)]",
                        disabled && "opacity-30 saturate-50",
                      )}
                      style={{
                        left: `${l.start * 100}%`,
                        width: `${(l.end - l.start) * 100}%`,
                        background: `color-mix(in oklab, ${kind.color} 30%, #14141a)`,
                        border: `1px solid color-mix(in oklab, ${kind.color} 65%, transparent)`,
                        borderLeft: `3px solid ${kind.color}`,
                      }}
                    >
                      <span className="text-[10.5px] font-semibold text-white/90 px-2 truncate">
                        {l.name}
                      </span>
                    </div>
                  </div>
                );
              })}

              <RegionHandles
                inFrac={inFrac}
                outFrac={outFrac}
                active={regionActive}
                onStart={(w) => s.setDrag(w)}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white -translate-x-1/2 z-[8] pointer-events-none shadow-[0_0_8px_rgba(255,255,255,.5)]"
                style={{ left: `${pct * 100}%` }}
              >
                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-[11px] h-2 bg-white rounded-b-[3px]" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
