import { Block, Text } from "@smoove/core";
import { T } from "../theme";
import { type DiagramCtx, row } from "./frame";

/** Title on the left, live composition clock pushed right by a grow strut. */
export function header(ctx: DiagramCtx, title: string): Block {
  const clock = new Text({
    text: "",
    fontSize: 22,
    fontFamily: T.mono,
    fill: T.muted,
    width: 260,
    wrap: "none",
    align: "right",
  });

  ctx.host.register((frame, info) => {
    clock.setText(`frame ${String(frame).padStart(3, "0")} · ${info.time.toFixed(2)}s`);
  });

  const r = row();
  r.add(new Text({ text: title, fontSize: 34, fill: T.text }));
  r.add(new Block({ flexGrow: 1 }));
  r.add(clock);
  return r;
}
