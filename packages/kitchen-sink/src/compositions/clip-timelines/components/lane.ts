import { Block, Clip, type ClipOptions, isClip, Text } from "@smoove/core";
import type Konva from "konva";
import { laneColor, T } from "../theme";
import { type DiagramCtx, labelCell, row, strut, trackCell } from "./frame";

// ---------------------------------------------------------------------------
// The lane component — and the recursion that makes the diagram build itself.
//
// A lane carries its own presentation metadata on the clip (`beat()` stamps
// it), so the renderer needs no parallel table: `laneTree()` walks the CLIP
// tree and emits a row per clip, recursing into each clip's own child clips.
// The component tree therefore mirrors the timeline tree exactly — nest a clip
// and its lane appears, indented, colored, and wired, with nothing to update
// anywhere else.
// ---------------------------------------------------------------------------

/** A clip that carries its lane's caption. Everything else is derived. */
export function beat(label: string, note: string, opts: ClipOptions): Clip {
  const clip = new Clip(opts);
  clip.setAttrs({ laneLabel: label, laneNote: note });
  return clip;
}

/** The clips directly under a container (a `Sequence` or a `Clip`), in add order. */
export function childClips(parent: Konva.Container): Clip[] {
  return parent.getChildren().filter((c) => isClip(c)) as Clip[];
}

type LaneEnv = {
  /** Nesting depth, from the recursion — not from walking ancestors. */
  depth: number;
  /** The frame this lane's parent timeline closes on; the root is the comp. */
  parentEnd: number;
  /** Traversal order, which picks the color. */
  index: number;
};

/** One lane row: [label cell | track cell]. */
function lane(clip: Clip, ctx: DiagramCtx, env: LaneEnv): Block {
  const color = laneColor(env.index);
  const start = clip.marker().start.resolve();
  const end = clip.marker().end.resolve();
  const dur = clip.durationInFrames;

  // How much of this clip's plan its parent's close makes unreachable.
  const overflow = Math.max(0, end - env.parentEnd);
  const reachable = dur - overflow;

  // -- label cell: caption is derived, the note is the author's intent -------
  const cell = labelCell(env.depth);
  cell.add(
    new Text({
      text: clip.getAttr("laneLabel") ?? "",
      fontSize: 22,
      fontFamily: T.mono,
      fill: T.text,
    }),
  );
  // Author's intent, then the range the engine actually resolved it to.
  cell.add(
    new Text({
      text: clip.getAttr("laneNote") ?? "",
      fontSize: 12,
      fontFamily: T.mono,
      fill: T.muted,
      wrap: "none",
      width: T.labelW,
    }),
  );
  cell.add(
    new Text({
      text: `${start}→${end} · ${dur}f`,
      fontSize: 12,
      fontFamily: T.mono,
      fill: T.dim,
      wrap: "none",
      width: T.labelW,
    }),
  );
  const clock = new Text({
    text: "",
    fontSize: 15,
    fontFamily: T.mono,
    fill: color,
    wrap: "none",
    width: T.labelW,
  });
  cell.add(clock);

  // -- track cell: [before | window | ghost | after], all in frame units -----
  const track = trackCell();
  track.add(strut(start));

  const windowBox = new Block({
    flexGrow: reachable,
    height: T.laneH,
    borderSize: 1.5,
    borderColor: color,
    cornerRadius: overflow ? [T.radius, 0, 0, T.radius] : T.radius,
    flexDirection: "row",
    padding: 3,
  });
  const fill = new Block({
    flexGrow: 0,
    height: "100%",
    background: color,
    cornerRadius: T.radius - 3,
    opacity: 0.35,
  });
  const fillRest = strut(reachable);
  windowBox.add(fill);
  windowBox.add(fillRest);
  track.add(windowBox);

  if (overflow) {
    // The tail of the plan the parent's close makes unreachable.
    track.add(
      new Block({
        flexGrow: overflow,
        height: T.laneH,
        background: color,
        cornerRadius: [0, T.radius, T.radius, 0],
        opacity: 0.1,
      }),
    );
  }
  track.add(strut(ctx.total - start - dur));

  // -- timing: reset before ticks, overwrite while this clip is active -------
  // (The reset lives here rather than in the composition because the animated
  // nodes sit in the layout tree, not inside the clip: an inactive clip stops
  // writing but cannot undo. Sequence updaters run before clip ticks.)
  ctx.host.register(() => {
    fill.setAttr("flexGrow", 0);
    fillRest.setAttr("flexGrow", reachable);
    clock.setText("");
  });
  clip.register((frame, info) => {
    fill.setAttr("flexGrow", frame);
    fillRest.setAttr("flexGrow", Math.max(reachable - frame, 0));
    clock.setText(`${frame}f · ${info.time.toFixed(2)}s`);
  });

  const laneRow = row(cell, track);
  laneRow.setAttr("flexGrow", 1); // lanes share the column's leftover height
  return laneRow;
}

/**
 * Render a clip and every clip nested under it, depth-first — the component
 * tree mirrors the timeline tree. Pass the sequence's top-level clips.
 */
export function laneTree(
  clips: readonly Clip[],
  ctx: DiagramCtx,
  env: { depth: number; parentEnd: number; index: number } = {
    depth: 0,
    parentEnd: ctx.total,
    index: 0,
  },
): Block[] {
  const rows: Block[] = [];
  let index = env.index;
  for (const clip of clips) {
    rows.push(lane(clip, ctx, { depth: env.depth, parentEnd: env.parentEnd, index }));
    index += 1;
    const nested = childClips(clip);
    if (nested.length > 0) {
      const childRows = laneTree(nested, ctx, {
        depth: env.depth + 1,
        parentEnd: clip.marker().end.resolve(),
        index,
      });
      rows.push(...childRows);
      index += childRows.length;
    }
  }
  return rows;
}
