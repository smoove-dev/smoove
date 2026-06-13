import type { ReadonlySignal } from "@konva-motion/core";
import type { KmPlayer } from "@konva-motion/player";
import { useEffect, useRef, useState } from "react";
import { useComposition } from "../../hooks/use-composition.js";
import { applyLayerVisibility } from "../../hooks/use-layers.js";
import { useShortcuts } from "../../hooks/use-shortcuts.js";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { fpsHealth } from "../../lib/format.js";
import { usePlayerSignal, useSignalValue } from "../../signals/signal-bridge.js";

const PAD = 40;
const ZERO_SIGNAL: ReadonlySignal<number> = { get: () => 0, subscribe: () => () => {} };

export type StageProps = {
  className?: string;
  /** Show the corner resolution/frame/scale readout (off by default). */
  showStatus?: boolean;
};

/**
 * The composition viewport. Mounts a `<km-player>`, registers it with the store,
 * and sizes it to the scaled comp box (fit-to-viewport, or an explicit zoom in
 * an overflow-scroll container). The player letterboxes inside that box.
 */
export function Stage({ className, showStatus = false }: StageProps) {
  const store = useStudio();
  const { composition: comp } = useComposition();
  const zoom = useSignalValue(store.zoom);
  const layerOffMap = useSignalValue(store.layerOff);
  const selectedId = useSignalValue(store.selectedId);
  useShortcuts();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<KmPlayer | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // measure available space
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // register the player + base attributes (we own keyboard + click-to-play)
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    el.setAttribute("no-keyboard", "");
    el.setAttribute("no-click-to-play", "");
    el.setAttribute("loop", "");
    // No autoplay: a composition loads stopped (paused on frame 0) by default.
    store.setPlayer(el);
    return () => {
      if (store.player.get() === el) store.setPlayer(null);
    };
  }, [store]);

  // mount / swap the composition
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    el.composition = comp ?? null;
    // After a dev hot-reload, restore the playhead + play state on the rebuilt
    // comp (the player setter mounts synchronously, so seekTo works here).
    if (comp) {
      const restore = store.takeRestore();
      if (restore) {
        el.seekTo(restore.frame);
        if (restore.playing) el.play();
        else el.pause();
      }
    }
  }, [comp, store]);

  // apply per-layer enable/disable
  useEffect(() => {
    if (comp) applyLayerVisibility(comp, layerOffMap[selectedId] ?? new Set());
  }, [comp, layerOffMap, selectedId]);

  const w = comp ? comp.width() : 1280;
  const h = comp ? comp.height() : 720;
  const fit = zoom === "fit";
  const fitScale = box.w
    ? Math.max(0.05, Math.min((box.w - PAD * 2) / w, (box.h - PAD * 2) / h))
    : 0.5;
  useEffect(() => {
    store.setFitScale(fitScale);
  }, [fitScale, store]);

  const scale = fit ? fitScale : (zoom as number);
  const overflow = !fit && (w * scale > box.w - 8 || h * scale > box.h - 8);

  return (
    <div
      ref={wrapRef}
      className={cn("relative flex-1 min-h-0 overflow-hidden", className)}
      style={{
        background: "radial-gradient(120% 90% at 50% 0%, #16151c 0%, var(--color-stage) 70%)",
      }}
    >
      <div
        className={cn(
          "absolute inset-0 flex p-10",
          overflow ? "overflow-auto scroll" : "items-center justify-center",
        )}
      >
        <div
          className="m-auto flex-none relative rounded-[4px] overflow-hidden bg-black shadow-[0_24px_80px_-20px_rgba(0,0,0,.8),0_0_0_1px_rgba(255,255,255,.06)]"
          style={{ width: w * scale, height: h * scale }}
        >
          <km-player ref={playerRef} style={{ position: "absolute", inset: 0 }} />
        </div>
      </div>

      {showStatus && comp && <StageStatus scale={scale} w={w} h={h} />}
    </div>
  );
}

function StageStatus({ scale, w, h }: { scale: number; w: number; h: number }) {
  const store = useStudio();
  const player = useSignalValue(store.player);
  const frame = usePlayerSignal(player?.state.frame ?? ZERO_SIGNAL);
  const total = usePlayerSignal(player?.state.duration ?? ZERO_SIGNAL);
  const fps = player?.fps ?? 0;
  const health = fpsHealth(fps, fps || 1);
  return (
    <div className="absolute bottom-3 left-4 z-[5] flex items-center gap-2.5 text-[11px] font-mono text-ink-3 bg-[rgba(16,16,20,.6)] backdrop-blur-md border border-line rounded-control px-2.5 py-1.5 pointer-events-none">
      <span
        className={cn(
          "size-[7px] rounded-full",
          health === "good" ? "bg-good" : health === "ok" ? "bg-warn" : "bg-ink-3/50",
        )}
      />
      <span className="text-ink-2 font-semibold">
        {w}×{h}
      </span>
      <span className="text-line-2">·</span>
      <span>
        {frame}/{total}f
      </span>
      <span className="text-line-2">·</span>
      <span>{Math.round(scale * 100)}%</span>
    </div>
  );
}
