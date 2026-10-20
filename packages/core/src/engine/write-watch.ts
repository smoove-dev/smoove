import Konva from "konva";
import { isDerivedWrite } from "../effects/dirty.js";

/** One position write an updater made. */
export type WriteRecord = { node: Konva.Node; attr: "x" | "y" };

const watchers = new Set<(w: WriteRecord) => void>();
let updaterDepth = 0;
let patched = false;

/**
 * @internal Run `fn` (a timeline's updater loop) so the writes it makes are
 * seen as updater writes. Layout and ticks run outside it.
 */
export function inUpdaters<T>(fn: () => T): T {
  updaterDepth++;
  try {
    return fn();
  } finally {
    updaterDepth--;
  }
}

/**
 * Patch Konva's change hook once, the first time anyone watches. Until then a
 * composition pays nothing, and afterwards an unwatched write costs one size
 * check.
 */
function install(): void {
  if (patched) return;
  patched = true;
  const proto = Konva.Node.prototype as unknown as {
    _fireChangeEvent: (attr: string, oldVal: unknown, newVal: unknown) => void;
  };
  const fire = proto._fireChangeEvent;
  proto._fireChangeEvent = function (attr, oldVal, newVal) {
    if (
      watchers.size > 0 &&
      updaterDepth > 0 &&
      !isDerivedWrite() &&
      (attr === "x" || attr === "y")
    ) {
      const record: WriteRecord = { node: this as unknown as Konva.Node, attr };
      for (const w of watchers) w(record);
    }
    return fire.call(this, attr, oldVal, newVal);
  };
}

/**
 * Call `onWrite` for every change of x or y an updater makes, until the
 * returned function is called. Writes from layout, ticks or code outside a
 * frame pass are never reported. Used by `@smoove/core/testing` to catch an
 * updater moving a node that a `Flex` or `Block` positions.
 */
export function watchUpdaterWrites(onWrite: (w: WriteRecord) => void): () => void {
  install();
  watchers.add(onWrite);
  return () => {
    watchers.delete(onWrite);
  };
}
