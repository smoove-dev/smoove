import { useRef } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { LayeredBody } from "./layered-body.js";
import { Scrubber } from "./scrubber.js";
import { TimelineHeader } from "./timeline-header.js";
import { Transport } from "./transport.js";

/** The full timeline dock: header (mode + readout), body (progress|layered), transport. */
export function Timeline({ className }: { className?: string }) {
  const store = useStudio();
  const tlMode = useSignalValue(store.tlMode);
  const layered = tlMode === "layered";
  return (
    <div className={cn("relative flex flex-col flex-none bg-bg-1 border-t border-line", className)}>
      {layered && <SplitHandle />}
      <TimelineHeader />
      {layered ? (
        <LayeredBody />
      ) : (
        <div className="px-3 pt-1 pb-2">
          <Scrubber />
        </div>
      )}
      <Transport />
    </div>
  );
}

/**
 * The border between the stage and the layered timeline: drag it to give the
 * tracks more or less height (remembered), double-click to reset. From the
 * keyboard, the up and down arrows resize it and Enter resets it.
 */
function SplitHandle() {
  const store = useStudio();
  const drag = useRef<{ y: number; h: number } | null>(null);
  const nudge = (dy: number): void =>
    store.setTimelineHeight(Math.max(0, store.timelineMaxHeight.get() + dy));
  return (
    <button
      type="button"
      aria-label="Resize the timeline"
      title="Drag to resize the timeline. Double-click to reset."
      className="absolute -top-[3px] left-0 right-0 h-[6px] z-30 cursor-row-resize outline-none hover:bg-accent/40 active:bg-accent/60 focus-visible:bg-accent/60"
      onDoubleClick={() => store.setTimelineHeight(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") nudge(24);
        else if (e.key === "ArrowDown") nudge(-24);
        else if (e.key === "Enter") store.setTimelineHeight(null);
        else return;
        e.preventDefault();
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, h: store.timelineMaxHeight.get() };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        // Dragging up grows the timeline. The store clamps it to the studio.
        store.setTimelineHeight(Math.max(0, d.h + (d.y - e.clientY)));
      }}
      onPointerUp={(e) => {
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    />
  );
}
