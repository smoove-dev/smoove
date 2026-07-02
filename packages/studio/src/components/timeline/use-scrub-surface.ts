import { useEffect, useRef, useState } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { clamp01 } from "../../lib/format.js";
import { useSignalValue } from "../../signals/signal-bridge.js";

export type DragKind = "seek" | "in" | "out";

/**
 * Shared pointer→frame drag handling for a scrub surface. Seeking maps the
 * cursor to a frame; dragging the loop in/out grips snaps the playhead to the
 * cursor too (per the design's "snap to cursor" requirement).
 */
export function useScrubSurface(total: number) {
  const store = useStudio();
  const player = useSignalValue(store.player);
  const region = useSignalValue(store.region);
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragKind | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const den = Math.max(1, total - 1);
  const inFrame = region.in ?? 0;
  const outFrame = region.out ?? den;

  const frac = (clientX: number): number => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return clamp01((clientX - r.left) / r.width);
  };
  const frameAt = (clientX: number): number => Math.round(frac(clientX) * den);
  const seekTo = (clientX: number): void => player?.seekTo(frameAt(clientX));

  // biome-ignore lint/correctness/useExhaustiveDependencies: store/player stable refs
  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => {
      const f = frameAt(e.clientX);
      if (drag === "seek") {
        player?.seekTo(f);
      } else if (drag === "in") {
        store.setRegionIn(f);
        player?.seekTo(f);
      } else if (drag === "out") {
        store.setRegionOut(f);
        player?.seekTo(f);
      }
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag, den, player, store]);

  return { ref, drag, setDrag, hover, setHover, frac, frameAt, seekTo, inFrame, outFrame, den };
}
