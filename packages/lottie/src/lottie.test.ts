import { Composition, Sequence } from "@smoove/core";
import { describe, expect, it } from "vitest";
import type { LottieEngine, LottieEngineOptions } from "./engine.js";
import { Lottie } from "./lottie.js";

/** A 24 fps, 48-frame, 200x200 animation that records every frame it is asked for. */
function stubEngine(): { engine: LottieEngine; frames: number[] } {
  const frames: number[] = [];
  let width = 1;
  let height = 1;
  const engine: LottieEngine = {
    ready: Promise.resolve(),
    fps: 24,
    totalFrames: 48,
    duration: 2,
    intrinsicSize: { width: 200, height: 200 },
    segment: [0, 48],
    setFrame: (frame) => frames.push(frame),
    get buffer() {
      return new Uint8Array(width * height * 4);
    },
    resize: (w, h) => {
      width = w;
      height = h;
    },
    destroy: () => {},
  };
  return { engine, frames };
}

let counter = 0;
function makeComp(): Composition {
  counter += 1;
  return new Composition({
    id: `lottie-t${counter}`,
    fps: 30,
    durationInFrames: 300,
    width: 640,
    height: 360,
  });
}

function mount(config: Record<string, unknown> = {}) {
  const stub = stubEngine();
  const options: LottieEngineOptions[] = [];
  const comp = makeComp();
  const seq = new Sequence({ from: 0, durationInFrames: 300 });
  const node = new Lottie({
    data: { fake: true },
    width: 100,
    height: 100,
    engineFactory: (opts) => {
      options.push(opts);
      return stub.engine;
    },
    ...config,
  });
  seq.add(node);
  comp.add(seq);
  return { comp, seq, node, frames: stub.frames, options };
}

describe("Lottie node", () => {
  it("maps composition frames onto the animation's own frame rate", async () => {
    const { comp, node, frames } = mount();
    await node.ready;
    comp.setFrame(0);
    comp.setFrame(15);
    // 30 fps composition, 24 fps animation: frame 15 is 0.5 s in = lottie 12.
    expect(frames.at(-1)).toBeCloseTo(12, 6);
  });

  it("freezes on the last frame past the end", async () => {
    const { comp, node, frames } = mount();
    await node.ready;
    comp.setFrame(250);
    expect(frames.at(-1)).toBeCloseTo(47, 6);
  });

  it("wraps when looping", async () => {
    const { comp, node, frames } = mount({ loop: true });
    await node.ready;
    // The animation is 2 s = 60 composition frames; frame 75 is 15 frames in.
    comp.setFrame(75);
    expect(frames.at(-1)).toBeCloseTo(12, 6);
  });

  it("applies speed", async () => {
    const { comp, node, frames } = mount({ speed: 2 });
    await node.ready;
    comp.setFrame(15);
    expect(frames.at(-1)).toBeCloseTo(24, 6);
  });

  it("passes objectFit and objectPosition to the engine", () => {
    const { options } = mount({ objectFit: "cover", objectPosition: "top left" });
    expect(options[0]?.fit).toBe("cover");
    expect(options[0]?.align).toEqual([0, 0]);
  });

  it("defaults to contain and centered", () => {
    const { options } = mount({ objectFit: undefined, objectPosition: undefined });
    expect(options[0]?.fit).toBe("contain");
    expect(options[0]?.align).toEqual([0.5, 0.5]);
  });

  it("takes its intrinsic size from the animation when unsized", async () => {
    const { node } = mount({ width: undefined, height: undefined });
    await node.ready;
    expect(node.width()).toBe(200);
    expect(node.height()).toBe(200);
  });

  it("keeps an explicit size over the intrinsic one", async () => {
    const { node } = mount({ width: 320, height: 180 });
    await node.ready;
    expect(node.width()).toBe(320);
    expect(node.height()).toBe(180);
  });

  it("does not re-seek when the resolved frame is unchanged", async () => {
    const { comp, node, frames } = mount();
    await node.ready;
    comp.setFrame(15);
    const count = frames.length;
    comp.setFrame(15);
    expect(frames.length).toBe(count);
  });

  it("rejects src and data together", () => {
    expect(() => new Lottie({ src: "/a.json", data: { fake: true } })).toThrow(
      /mutually exclusive/i,
    );
  });

  it("rejects neither src nor data", () => {
    expect(() => new Lottie({})).toThrow(/src.*data/i);
  });
});
