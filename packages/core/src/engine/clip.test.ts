import Konva from "konva";
import { describe, expect, it, vi } from "vitest";
import { MEDIA_MARK, TICK_MARK } from "../markers.js";
import { Clip } from "./clip.js";
import { Composition } from "./composition.js";
import { Sequence } from "./sequence.js";
import type { FrameInfo } from "./timeline.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `clip-t${n}`,
    fps: 30,
    durationInFrames: 300,
    width: 320,
    height: 240,
  });
}

/** A minimal tickable: a Konva node flagged with `mark` plus spied hooks. */
function makeTickable(mark: string = TICK_MARK): {
  node: Konva.Rect;
  tick: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
} {
  const node = new Konva.Rect({ width: 10, height: 10 });
  node.setAttr(mark, true);
  const tick = vi.fn();
  const deactivate = vi.fn();
  const t = node as unknown as {
    _kmTick: (f: number, m?: boolean) => void;
    _kmDeactivate: () => void;
    _bindMixer: () => void;
  };
  t._kmTick = tick;
  t._kmDeactivate = deactivate;
  // Media nodes get mixer-registered by Composition.add — a fake needs the hook.
  t._bindMixer = () => {};
  return { node, tick, deactivate };
}

describe("Clip range gating", () => {
  it("is hidden and un-ticked outside [from, from + durationInFrames)", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const clip = new Clip({ from: 10, durationInFrames: 20 });
    const updater = vi.fn();
    clip.register(updater);
    seq.add(clip);
    comp.add(seq); // paints frame 0 — clip not yet in range

    expect(clip.visible()).toBe(false);
    expect(updater).not.toHaveBeenCalled();

    comp.setFrame(10);
    expect(clip.visible()).toBe(true);
    expect(updater).toHaveBeenLastCalledWith(0, expect.anything());

    comp.setFrame(29);
    expect(updater).toHaveBeenLastCalledWith(19, expect.anything());

    comp.setFrame(30); // window closed
    expect(clip.visible()).toBe(false);
    expect(updater).toHaveBeenCalledTimes(2);
  });

  it("deactivates its media when leaving range, and when the host sequence deactivates", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const clip = new Clip({ from: 0, durationInFrames: 50 });
    const media = makeTickable(MEDIA_MARK);
    clip.add(media.node);
    seq.add(clip);
    comp.add(seq);

    comp.setFrame(1);
    expect(media.tick).toHaveBeenLastCalledWith(1, true);

    comp.setFrame(60); // clip window closed, sequence still active
    expect(media.deactivate).toHaveBeenCalledTimes(1);
    expect(clip.visible()).toBe(false);

    comp.setFrame(10); // back inside — reactivates
    expect(clip.visible()).toBe(true);
    expect(media.tick).toHaveBeenLastCalledWith(10, true);

    comp.setFrame(150); // sequence window closed — deactivation recurses into the clip
    expect(media.deactivate).toHaveBeenCalledTimes(2);
    expect(clip.visible()).toBe(false);
  });

  it("defaults its duration to the remainder of the parent timeline", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const clip = new Clip({ from: 30 });
    seq.add(clip);
    comp.add(seq);
    expect(clip.durationInFrames).toBe(70);
  });
});

describe("Clip nested clocks", () => {
  it("hands each nesting level its own local frame and FrameInfo", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 10, durationInFrames: 100 });
    const outer = new Clip({ from: 5, durationInFrames: 50 });
    const inner = new Clip({ from: 3, durationInFrames: 20 });
    const seen: Record<string, { frame: number; info: FrameInfo }> = {};
    seq.register((frame, info) => {
      seen.seq = { frame, info };
    });
    outer.register((frame, info) => {
      seen.outer = { frame, info };
    });
    inner.register((frame, info) => {
      seen.inner = { frame, info };
    });
    outer.add(inner);
    seq.add(outer);
    comp.add(seq);

    comp.setFrame(20);
    expect(seen.seq?.frame).toBe(10);
    expect(seen.outer?.frame).toBe(5);
    expect(seen.inner?.frame).toBe(2);

    // globalFrame is absolute at every depth; time is local seconds.
    expect(seen.seq?.info).toMatchObject({ fps: 30, globalFrame: 20, durationInFrames: 100 });
    expect(seen.outer?.info).toMatchObject({ fps: 30, globalFrame: 20, durationInFrames: 50 });
    expect(seen.inner?.info).toMatchObject({ fps: 30, globalFrame: 20, durationInFrames: 20 });
    expect(seen.inner?.info.time).toBeCloseTo(2 / 30);
  });

  it("resolves marker points through the parent chain to absolute frames", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 10, durationInFrames: 100 });
    const clip = new Clip({ from: 5, durationInFrames: 20 });
    seq.add(clip);
    comp.add(seq);

    expect(clip.marker().start.resolve()).toBe(15);
    expect(clip.marker().end.resolve()).toBe(35);

    // Another sequence can anchor to a point inside the clip.
    const anchored = new Sequence({ from: clip.marker().end, durationInFrames: 10 });
    comp.add(anchored);
    expect(anchored.from).toBe(35);
  });
});

describe("per-timeline ticking", () => {
  it("ticks a marked node inside a clip exactly once, with the clip's clock", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const clip = new Clip({ from: 4, durationInFrames: 50 });
    const { node, tick } = makeTickable();
    clip.add(node);
    seq.add(clip);
    comp.add(seq);

    comp.setFrame(10);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledWith(6, true); // clip-local, not sequence-local
  });

  it("still ticks late-added nodes buried deep inside a mounted subtree", () => {
    // Stronger than the old dirty-flag guarantee: the add happens on an inner
    // plain Konva.Group, which the old Sequence.add override never saw.
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const inner = new Konva.Group();
    seq.add(inner);
    comp.add(seq);

    const { node, tick } = makeTickable();
    inner.add(node); // deep add, after activation
    comp.setFrame(1);
    expect(tick).toHaveBeenCalledWith(1, true);
  });

  it("skips media-only nodes inside clips on the measure pass (tickMedia: false)", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const clip = new Clip({ from: 0, durationInFrames: 50 });
    const media = makeTickable(MEDIA_MARK);
    const ticker = makeTickable(TICK_MARK);
    clip.add(media.node);
    clip.add(ticker.node);
    seq.add(clip);
    comp.add(seq);
    media.tick.mockClear();
    ticker.tick.mockClear();

    seq._kmRunFrame(5, false);
    expect(media.tick).not.toHaveBeenCalled();
    expect(ticker.tick).toHaveBeenCalledWith(5, false);
  });
});

describe("updater payload back-compat", () => {
  it("keeps one-argument updaters working and hands two-argument ones FrameInfo", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const oneArg = vi.fn((frame: number) => frame);
    seq.register(oneArg);
    comp.add(seq);

    comp.setFrame(7);
    expect(oneArg).toHaveBeenLastCalledWith(7, {
      time: 7 / 30,
      fps: 30,
      durationInFrames: 100,
      globalFrame: 7,
    });
  });
});

describe("query caching", () => {
  it("caches string selectors until the structure changes", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const music = new Konva.Rect({ id: "music" });
    seq.add(music);
    comp.add(seq);

    const first = comp.query("#music");
    expect(first).toHaveLength(1);
    expect(comp.query("#music")).toBe(first); // cache hit: same array instance

    seq.add(new Konva.Rect({ id: "music" })); // structural change invalidates
    const second = comp.query("#music");
    expect(second).not.toBe(first);
    expect(second).toHaveLength(2);

    music.destroy();
    expect(comp.query("#music")).toHaveLength(1);
  });

  it("scopes timeline queries to the subtree and finds across sequences from the comp", () => {
    const comp = makeComp();
    const a = new Sequence();
    const b = new Sequence();
    a.add(new Konva.Rect({ name: "dot" }));
    b.add(new Konva.Rect({ name: "dot" }));
    comp.add(a);
    comp.add(b);

    expect(a.query(".dot")).toHaveLength(1);
    expect(comp.query(".dot")).toHaveLength(2);
    expect(comp.queryOne(".dot")).not.toBeNull();
    expect(comp.queryOne("#missing")).toBeNull();
  });

  it("leaves predicate queries uncached but working", () => {
    const comp = makeComp();
    const seq = new Sequence();
    seq.add(new Konva.Circle({ radius: 5 }));
    comp.add(seq);
    expect(comp.query((node) => node.className === "Circle")).toHaveLength(1);
  });
});

describe("ancestor getters", () => {
  it("resolves getComposition/getSequence/getClip from any depth", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const clip = new Clip({ from: 0, durationInFrames: 10 });
    const inner = new Clip({ from: 0, durationInFrames: 5 });
    clip.add(inner);
    seq.add(clip);
    comp.add(seq);

    expect(inner.getComposition()).toBe(comp);
    expect(inner.getSequence()).toBe(seq);
    expect(inner.getClip()).toBe(inner); // self-inclusive
    expect(clip.getClip()).toBe(clip);
    expect(seq.getSequence()).toBe(seq);
    expect(seq.getClip()).toBeNull();
  });
});
