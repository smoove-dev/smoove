import { describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Block } from "./block.js";
import { Text } from "./text/text.js";

// Regression: flexily computes NaN cross-axis positions for children of an
// alignItems: "center" (or flex-end) container whose cross size is hug/auto.
// The writeBack guard re-derives the offset from the resolved sizes — see
// fixNaNCross in flex/flex.ts.

let n = 0;
function makeScene(): { comp: Composition; page: Block } {
  n += 1;
  const comp = new Composition({
    id: `align-hug-${n}`,
    fps: 30,
    durationInFrames: 10,
    width: 1280,
    height: 720,
  });
  const seq = new Sequence();
  comp.add(seq);
  const page = new Block({ x: 0, y: 0, width: 1280, height: 720, flexDirection: "column" });
  seq.add(page);
  return { comp, page };
}

describe("alignItems center in a hug-height container", () => {
  it("centers children instead of collapsing to NaN", () => {
    const { comp, page } = makeScene();
    const row = new Block({ flexDirection: "row", alignItems: "center", width: "100%" });
    const short = new Block({ width: 50, height: 20, background: "#f00" });
    const tall = new Block({ width: 50, height: 30, background: "#0f0" });
    row.add(short);
    row.add(tall);
    page.add(row);
    comp.setFrame(1);

    // Hug height = tallest child (30); the short child centers at (30-20)/2.
    expect(short.y()).toBe(5);
    expect(tall.y()).toBe(0);
    expect(short.x()).toBe(0);
    expect(tall.x()).toBe(50);
  });

  it("keeps empty flexGrow spacers and their siblings finite", () => {
    const { comp, page } = makeScene();
    const header = new Block({ flexDirection: "row", alignItems: "center", width: "100%" });
    const title = new Text({ text: "title", fontSize: 34, fill: "#fff" });
    const spacer = new Block({ flexGrow: 1 });
    const clock = new Text({ text: "clock", fontSize: 22, fill: "#888" });
    header.add(title);
    header.add(spacer);
    header.add(clock);
    page.add(header);
    comp.setFrame(1);

    // The spacer pushes the clock to the right edge; nothing is NaN.
    expect(Number.isFinite(clock.x())).toBe(true);
    expect(Number.isFinite(clock.y())).toBe(true);
    expect(clock.x()).toBeGreaterThan(1000);
    expect(title.x()).toBe(0);
  });

  it("respects flex-end and padding in the fallback", () => {
    const { comp, page } = makeScene();
    const row = new Block({
      flexDirection: "row",
      alignItems: "flex-end",
      width: "100%",
      padding: [4, 0],
    });
    const short = new Block({ width: 50, height: 20, background: "#f00" });
    const tall = new Block({ width: 50, height: 30, background: "#0f0" });
    row.add(short);
    row.add(tall);
    page.add(row);
    comp.setFrame(1);

    // Content box is 30 tall (padding 4 top/bottom); short sits at its bottom.
    expect(short.y()).toBe(4 + 10);
    expect(tall.y()).toBe(4);
  });
});
