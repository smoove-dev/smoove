import Konva from "konva";
import { describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Text } from "../layout/text/text.js";
import { contrastSweep } from "./contrast.js";
import { sweepContext } from "./purity.js";

let n = 0;
function onBackground(bg: string, size = 1080): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `contrast-t${n}`,
    fps: 30,
    durationInFrames: 30,
    width: size,
    height: size,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 30 });
  seq.add(new Konva.Rect({ x: 0, y: 0, width: size, height: size, fill: bg }));
  comp.add(seq);
  return { comp, seq };
}

const PALETTE = ["#0c0b16", "#9a95b8", "#ffd23f"];

describe("contrastSweep", () => {
  it("flags small muted text on yellow and suggests the palette's dark", async () => {
    const { comp, seq } = onBackground("#ffd23f");
    seq.add(
      new Text({
        name: "caption",
        text: "Ships Monday",
        fontSize: 34,
        fill: "#9a95b8",
        x: 100,
        y: 100,
      }),
    );
    const hits = await contrastSweep(sweepContext(comp), PALETTE);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.code).toBe("layout/contrast");
    expect(hits[0]?.details?.ratio).toBeCloseTo(2.0, 1);
    expect(hits[0]?.details).toMatchObject({
      text: "#9a95b8",
      background: "#ffd23f",
      floor: 4.5,
      suggestion: "#0c0b16",
    });
  });

  it("uses the large-text floor from 48 times u", async () => {
    const { comp, seq } = onBackground("#ffd23f");
    seq.add(new Text({ text: "Big", fontSize: 96, fill: "#9a95b8", x: 100, y: 100 }));
    const hits = await contrastSweep(sweepContext(comp), PALETTE);
    expect(hits[0]?.details?.floor).toBe(3);
  });

  it("passes light text on near-black", async () => {
    const { comp, seq } = onBackground("#0c0b16");
    seq.add(new Text({ text: "Readable", fontSize: 34, fill: "#f5f2ff", x: 100, y: 100 }));
    expect(await contrastSweep(sweepContext(comp), PALETTE)).toEqual([]);
  });

  it("skips faint decoration and text with no fill", async () => {
    const { comp, seq } = onBackground("#ffd23f");
    seq.add(
      new Text({ text: "Ghost", fontSize: 200, fill: "#fff3c0", opacity: 0.2, x: 0, y: 300 }),
    );
    seq.add(new Text({ text: "Outline", fontSize: 60, fill: "", x: 100, y: 700 }));
    expect(await contrastSweep(sweepContext(comp), PALETTE)).toEqual([]);
  });

  it("judges by the worst tenth of the background, not its average", async () => {
    const { comp, seq } = onBackground("#f0f0f0");
    seq.add(new Konva.Rect({ x: 0, y: 0, width: 700, height: 1080, fill: "#111111" }));
    seq.add(
      new Text({ text: "Contrast across the split", fontSize: 60, fill: "#333333", x: 40, y: 500 }),
    );
    const hits = await contrastSweep(sweepContext(comp), null);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.details?.background).toBe("#111111");
  });

  it("skips text a closed clip window hides", async () => {
    const { comp, seq } = onBackground("#ffd23f");
    const window = new Konva.Group({ clip: { x: 0, y: 0, width: 0, height: 200 } });
    window.add(new Text({ text: "Hidden", fontSize: 34, fill: "#9a95b8", x: 100, y: 100 }));
    seq.add(window);
    expect(await contrastSweep(sweepContext(comp), PALETTE)).toEqual([]);
  });

  it("skips typewriter text that hasn't been typed yet", async () => {
    const { comp, seq } = onBackground("#ffd23f");
    seq.add(
      new Text({
        text: "Not yet",
        fontSize: 34,
        fill: "#9a95b8",
        x: 100,
        y: 100,
        typewriter: { startFrame: 100, durationInFrames: 10 },
      }),
    );
    expect(await contrastSweep(sweepContext(comp), PALETTE)).toEqual([]);
  });
});
