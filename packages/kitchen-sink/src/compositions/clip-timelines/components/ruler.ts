import { Block, Text } from "@smoove/core";
import { T } from "../theme";
import { type DiagramCtx, labelCell, row, trackCell } from "./frame";

/**
 * One equal-grow segment per second, counted off the composition itself —
 * change the comp's duration or fps and the ruler follows.
 */
export function ruler(ctx: DiagramCtx): Block {
  const fps = ctx.host.getComposition()?.fps ?? 30;
  const seconds = Math.round(ctx.total / fps);

  const track = trackCell();
  for (let s = 0; s < seconds; s++) {
    const seg = new Block({
      flexGrow: 1,
      borderSize: [0, 0, 0, 1],
      borderColor: T.track,
      padding: [0, 0, 4, 6],
    });
    seg.add(
      new Text({
        text: `${s}s`,
        fontSize: 13,
        fontFamily: T.mono,
        fill: T.muted,
        width: 30,
        wrap: "none",
      }),
    );
    track.add(seg);
  }
  return row(labelCell(), track);
}
