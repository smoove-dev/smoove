import type { MarkRect } from "@smoove/agent";
import type { ReadonlySignal } from "@smoove/core";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { usePlayerSignal, useSignalValue } from "../../signals/signal-bridge.js";
import { Icon } from "../icon/icon.js";

/** Screen pixels the pointer moves before a press becomes a drag. */
const DRAG_FROM = 4;
/** A mark under this many composition pixels on a side is an accident. */
const MIN_MARK = 2;
const ZERO_SIGNAL: ReadonlySignal<number> = { get: () => 0, subscribe: () => () => {} };

type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * The user's mark for the agent: drag on the frame to draw a rectangle, which
 * the studio sends to the dev server for `smoove context`. Plain DOM over the
 * player, so no capture or render ever shows it. Only there while a bridge is
 * connected.
 */
export function MarkOverlay({ scale, w, h }: { scale: number; w: number; h: number }) {
  const store = useStudio();
  const live = useSignalValue(store.markLive);
  const mark = useSignalValue(store.mark);
  const selectedId = useSignalValue(store.selectedId);
  const player = useSignalValue(store.player);
  const frame = usePlayerSignal(player?.state.frame ?? ZERO_SIGNAL);
  const ref = useRef<HTMLDivElement | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Box | null>(null);

  const shown = mark && mark.composition === selectedId ? mark : null;

  // Escape cancels a drag, or clears the standing mark (not while a drawer is open).
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape in a field (the props inspector) belongs to that field.
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (press.current) {
        press.current = null;
        setDrag(null);
        return;
      }
      if (store.mark.get() && !store.libraryOpen.get() && !store.panelOpen.get()) {
        void store.clearMark();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, store]);

  if (!live) return null;

  const W = w * scale;
  const H = h * scale;
  const local = (e: PointerEvent): { x: number; y: number } => {
    const r = ref.current?.getBoundingClientRect();
    const x = e.clientX - (r?.left ?? 0);
    const y = e.clientY - (r?.top ?? 0);
    return { x: Math.max(0, Math.min(W, x)), y: Math.max(0, Math.min(H, y)) };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = local(e);
    // Drawing on a playing frame pauses it, and it stays paused.
    if (store.composition.get()?.isPlaying.get()) player?.pause();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p) return;
    const q = local(e);
    if (!drag && Math.hypot(q.x - p.x, q.y - p.y) < DRAG_FROM) return;
    setDrag({ x0: p.x, y0: p.y, x1: q.x, y1: q.y });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    // A plain click on the frame clears the mark, like clicking away from a selection.
    if (!drag) {
      if (shown) void store.clearMark();
      return;
    }
    const q = local(e);
    setDrag(null);
    const rect: MarkRect = {
      x: Math.min(p.x, q.x) / scale,
      y: Math.min(p.y, q.y) / scale,
      width: Math.abs(q.x - p.x) / scale,
      height: Math.abs(q.y - p.y) / scale,
    };
    if (rect.width < MIN_MARK || rect.height < MIN_MARK) return;
    void store.drawMark(rect);
  };

  const onPointerCancel = () => {
    press.current = null;
    setDrag(null);
  };

  const box = drag
    ? {
        left: Math.min(drag.x0, drag.x1),
        top: Math.min(drag.y0, drag.y1),
        width: Math.abs(drag.x1 - drag.x0),
        height: Math.abs(drag.y1 - drag.y0),
      }
    : shown
      ? {
          left: shown.rect.x * scale,
          top: shown.rect.y * scale,
          width: shown.rect.width * scale,
          height: shown.rect.height * scale,
        }
      : null;
  const away = !drag && shown != null && frame !== shown.frame;

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-[2] cursor-crosshair select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {box && (
        // Viewfinder-style framing: corner brackets over a faint outline. On
        // its own frame (and while drawing) the rest of the frame dims, so
        // what's marked stands out; elsewhere the mark only fades.
        <div
          className={cn(
            "absolute pointer-events-none rounded-[3px] border border-accent-line transition-opacity",
            away ? "opacity-50" : "shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]",
          )}
          style={box}
        >
          {CORNERS.map((c) => (
            <span key={c} className={cn("absolute size-3.5 border-accent", c)} />
          ))}
        </div>
      )}
      {box && !drag && shown && (
        // One tab on the mark's top edge: clear it, or jump back to its frame.
        <div
          className="absolute flex items-stretch h-[22px] rounded-t-[5px] overflow-hidden bg-accent text-white text-[11px] font-medium shadow-[0_2px_8px_rgba(0,0,0,0.35)] pointer-events-auto"
          style={{
            left: box.left - 1,
            top: box.top >= 22 ? box.top - 22 : box.top,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Clear mark"
            title="Clear mark (Escape)"
            className="grid place-items-center w-[22px] hover:bg-black/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            onClick={() => void store.clearMark()}
          >
            <Icon name="close" size={12} />
          </button>
          <span className="w-px my-[5px] bg-white/35" aria-hidden="true" />
          <button
            type="button"
            title={away ? "Go to the marked frame" : "The marked frame"}
            className="px-2 tabular-nums hover:bg-black/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            onClick={() => player?.seekTo(shown.frame)}
          >
            Frame {shown.frame}
          </button>
        </div>
      )}
    </div>
  );
}

/** The four L-shaped brackets, each on its own corner. */
const CORNERS = [
  "-left-px -top-px border-l-2 border-t-2 rounded-tl-[3px]",
  "-right-px -top-px border-r-2 border-t-2 rounded-tr-[3px]",
  "-left-px -bottom-px border-l-2 border-b-2 rounded-bl-[3px]",
  "-right-px -bottom-px border-r-2 border-b-2 rounded-br-[3px]",
];
