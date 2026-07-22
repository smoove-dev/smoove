import { Block } from "@smoove/core";
import { T } from "../theme";
import { type DiagramCtx, labelCell, row, strut, trackCell } from "./frame";

/** The playhead as a [done | todo] strip — both halves grow in frame units. */
export function progress(ctx: DiagramCtx): Block {
  const strip = new Block({
    flexGrow: 1,
    height: 8,
    background: T.track,
    cornerRadius: 4,
    flexDirection: "row",
  });
  const done = new Block({
    flexGrow: 0,
    height: "100%",
    background: T.text,
    cornerRadius: 4,
    opacity: 0.7,
  });
  const todo = strut(ctx.total);
  strip.add(done);
  strip.add(todo);

  ctx.host.register((frame) => {
    done.setAttr("flexGrow", frame);
    todo.setAttr("flexGrow", ctx.total - frame);
  });

  const track = trackCell();
  track.add(strip);
  return row(labelCell(), track);
}
