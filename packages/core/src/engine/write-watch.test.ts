import Konva from "konva";
import { describe, expect, it } from "vitest";
import { Block } from "../layout/block.js";
import { Composition } from "./composition.js";
import { Sequence } from "./sequence.js";
import { type WriteRecord, watchUpdaterWrites } from "./write-watch.js";

let n = 0;
function setup(write: (child: Konva.Rect, frame: number) => void) {
  n += 1;
  const comp = new Composition({
    id: `write-watch-t${n}`,
    fps: 30,
    durationInFrames: 100,
    width: 400,
    height: 200,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 100 });
  const card = new Block({ width: 300, height: 100, flexDirection: "row", gap: 10 });
  const child = new Konva.Rect({ width: 40, height: 40, name: "chip" });
  card.add(child);
  card.add(new Konva.Rect({ width: 40, height: 40 }));
  seq.add(card);
  seq.register((frame) => write(child, frame));
  comp.add(seq);
  return { comp, child };
}

describe("watchUpdaterWrites", () => {
  it("reports an updater moving x, once per frame, and never the layout's own writes", () => {
    const { comp, child } = setup((c, f) => c.x(f * 5 + 1));
    const seen: WriteRecord[] = [];
    const stop = watchUpdaterWrites((w) => seen.push(w));
    comp.setFrame(3);
    comp.setFrame(4);
    stop();

    expect(seen).toHaveLength(2);
    expect(seen.every((w) => w.node === child && w.attr === "x")).toBe(true);
  });

  it("reports nothing after stop", () => {
    const { comp } = setup((c, f) => c.y(f + 1));
    const seen: WriteRecord[] = [];
    const stop = watchUpdaterWrites((w) => seen.push(w));
    stop();
    comp.setFrame(5);

    expect(seen).toHaveLength(0);
  });

  it("ignores writes other than x and y", () => {
    const { comp } = setup((c, f) => c.opacity(f / 100));
    const seen: WriteRecord[] = [];
    const stop = watchUpdaterWrites((w) => seen.push(w));
    comp.setFrame(6);
    comp.setFrame(7);
    stop();

    expect(seen).toHaveLength(0);
  });
});
