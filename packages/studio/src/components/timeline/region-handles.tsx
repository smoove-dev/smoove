import type { DragKind } from "./use-scrub-surface.js";

/** A draggable loop in/out grip. Module-level so it isn't remounted as the
    scrubber re-renders on the playhead clock (clicks would otherwise be lost). */
function RegionHandle({
  which,
  frac,
  onStart,
}: {
  which: "in" | "out";
  frac: number;
  onStart: (which: DragKind, e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="absolute top-0 bottom-0 w-[11px] -translate-x-1/2 z-[5] cursor-ew-resize flex items-start justify-center group/h"
      style={{ left: `${frac * 100}%` }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onStart(which, e);
      }}
      title={which === "in" ? "Loop start" : "Loop end"}
    >
      <span className="w-[3px] h-full bg-accent rounded-sm shadow-[0_0_6px_var(--color-accent-soft)] group-hover/h:w-1 group-hover/h:bg-accent-2" />
    </div>
  );
}

export function RegionHandles({
  inFrac,
  outFrac,
  active,
  onStart,
}: {
  inFrac: number;
  outFrac: number;
  active: boolean;
  onStart: (which: DragKind, e: React.MouseEvent) => void;
}) {
  return (
    <>
      {active && (
        <div
          className="absolute top-0 bottom-0 bg-accent/13 border-x border-accent/55 pointer-events-none z-[1]"
          style={{ left: `${inFrac * 100}%`, width: `${(outFrac - inFrac) * 100}%` }}
        />
      )}
      <RegionHandle which="in" frac={inFrac} onStart={onStart} />
      <RegionHandle which="out" frac={outFrac} onStart={onStart} />
    </>
  );
}
