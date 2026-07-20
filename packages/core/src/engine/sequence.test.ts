import Konva from "konva";
import { describe, expect, it, vi } from "vitest";
import { TICK_MARK } from "../markers.js";
import { Composition } from "./composition.js";
import { Sequence } from "./sequence.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({ id: `seq-t${n}`, fps: 30, durationInFrames: 300, width: 320, height: 240 });
}

/** A minimal tickable: a Konva node flagged with TICK_MARK plus a spied `_kmTick`. */
function makeTickable(): { node: Konva.Rect; tick: ReturnType<typeof vi.fn> } {
  const node = new Konva.Rect({ width: 10, height: 10 });
  node.setAttr(TICK_MARK, true);
  const tick = vi.fn();
  (node as unknown as { _kmTick: (f: number) => void })._kmTick = tick;
  return { node, tick };
}

describe("Sequence tickable cache", () => {
  it("ticks media/ticker nodes added AFTER the sequence was added to the composition", () => {
    // The `beat()` pattern: an empty Sequence is added to the composition (which
    // activates it to paint frame 0) and only then are its children added. A
    // stale per-activation cache dropped these late-added tickables — the video
    // froze. See the regression where snoove-showcase's greeting video stuck on
    // frame 0.
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    comp.add(seq); // activates `seq` while it is still empty
    const { node, tick } = makeTickable();
    seq.add(node); // added after activation

    comp.setFrame(1);
    expect(tick).toHaveBeenCalledWith(1);
  });

  it("still ticks nodes added before the sequence is added (baseline)", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const { node, tick } = makeTickable();
    seq.add(node);
    comp.add(seq);

    comp.setFrame(2);
    expect(tick).toHaveBeenCalledWith(2);
  });
});
