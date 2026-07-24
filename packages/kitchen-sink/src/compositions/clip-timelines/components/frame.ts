import type { Sequence } from "@smoove/core";
import { Block } from "@smoove/core";
import { T } from "../theme";

// The shared row skeleton — the diagram's "grid". Every row in the page is
// [label cell | track cell], which is the only reason rulers, strips and lanes
// line up: they share these primitives, not a hardcoded x.

/**
 * What every component needs from the diagram above it: the host sequence
 * (for pre-tick resets) and the horizontal scale.
 *
 * `total` is the composition's duration in frames, and it IS the unit system:
 * a track's children carry `flexGrow` values measured in frames, so the whole
 * diagram rescales when the page resizes or the comp is retimed.
 */
export type DiagramCtx = {
  host: Sequence;
  total: number;
};

/** Build the context from a host sequence, reading the scale off the comp. */
export function diagramCtx(host: Sequence): DiagramCtx {
  return { host, total: host.getComposition()?.durationInFrames.get() ?? 1 };
}

/** The shared left column. Indent grows with nesting depth. */
export function labelCell(depth = 0): Block {
  return new Block({
    width: T.labelW,
    flexDirection: "column",
    gap: 2,
    padding: [0, 0, 0, depth * T.indentStep],
  });
}

/** The shared right column: takes whatever width the row has left. */
export function trackCell(): Block {
  return new Block({ flexDirection: "row", alignItems: "center", flexGrow: 1 });
}

/** An invisible strut `frames` wide, in track units. */
export function strut(frames: number): Block {
  return new Block({ flexGrow: Math.max(frames, 0) });
}

/** A full-width row of the page. */
export function row(...cells: Block[]): Block {
  const r = new Block({ flexDirection: "row", alignItems: "center", width: "100%" });
  for (const c of cells) r.add(c);
  return r;
}
