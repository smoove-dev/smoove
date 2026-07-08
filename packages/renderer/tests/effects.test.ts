import { createRequire } from "node:module";
import { Composition, Rect, Sequence, setEffectShaderFactory } from "@smoove/core";
import { blur, chromaKey, shine, water } from "@smoove/effects";
import { beforeAll, describe, expect, it } from "vitest";
import { setupServerRendering } from "../src/setup.js";
import "../src/gl.js"; // wires headless-gl for shader passes (no-op if `gl` missing)
import type { Canvas } from "skia-canvas";

const W = 256;
const H = 256;

beforeAll(() => {
  setupServerRendering();
});

let compCount = 0;

function makeComp(): { comp: Composition; seq: Sequence } {
  const comp = new Composition({
    id: `fx-test-${compCount++}`,
    width: W,
    height: H,
    fps: 30,
    durationInFrames: 30,
  });
  const seq = new Sequence();
  comp.add(seq);
  return { comp, seq };
}

async function frame(comp: Composition, f = 0): Promise<ImageData> {
  await comp.renderFrame(f);
  const canvas = comp.captureCanvas() as unknown as Canvas;
  return canvas.getContext("2d").getImageData(0, 0, W, H) as unknown as ImageData;
}

function px(id: ImageData, x: number, y: number): number[] {
  const i = (y * W + x) * 4;
  return [
    id.data[i] as number,
    id.data[i + 1] as number,
    id.data[i + 2] as number,
    id.data[i + 3] as number,
  ];
}

describe("effects render server-side", () => {
  it("blur softens a hard edge", async () => {
    const build = async (effects?: ReturnType<typeof blur>[]) => {
      const { comp, seq } = makeComp();
      seq.add(new Rect({ x: 64, y: 64, width: 128, height: 128, fill: "#ff0000", effects }));
      const id = await frame(comp);
      comp.destroy();
      return id;
    };
    const sharp = await build(undefined);
    const blurred = await build([blur({ radius: 12 })]);
    // Just outside the rect edge: sharp render is transparent, blurred bleeds red.
    expect(px(sharp, 60, 128)[3]).toBe(0);
    expect(px(blurred, 60, 128)[3]).toBeGreaterThan(0);
  });

  it("chromaKey (Sequence-level) keys the green out and keeps the subject", async () => {
    const { comp, seq } = makeComp();
    seq.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#00b140" }));
    seq.add(new Rect({ x: 96, y: 96, width: 64, height: 64, fill: "#ff3333" }));
    seq.effects([chromaKey()]);
    const id = await frame(comp);
    expect(px(id, 10, 10)[3]).toBe(0); // green backdrop keyed out
    expect(px(id, 128, 128)[3]).toBe(255); // red square survives
    comp.destroy();
  });

  it("shine brightens a band without leaking outside the node's alpha", async () => {
    const { comp, seq } = makeComp();
    seq.add(
      new Rect({
        x: 64,
        y: 64,
        width: 128,
        height: 128,
        fill: "#333333",
        effects: [shine({ progress: 0.5, angle: 0, width: 40, intensity: 1 })],
      }),
    );
    const id = await frame(comp);
    const center = px(id, 128, 128); // band center: brightened
    const corner = px(id, 70, 70); // inside rect, off-band: base gray
    expect(center[0] as number).toBeGreaterThan((corner[0] as number) + 40);
    expect(px(id, 10, 10)[3]).toBe(0); // outside the node stays empty
    comp.destroy();
  });

  it("frames are deterministic across repeated renders", async () => {
    const build = async () => {
      const { comp, seq } = makeComp();
      seq.add(
        new Rect({
          x: 32,
          y: 32,
          width: 96,
          height: 96,
          fill: "#3366ff",
          effects: [blur({ radius: 6 }), shine({ progress: 0.3 })],
        }),
      );
      const id = await frame(comp, 5);
      comp.destroy();
      return id;
    };
    const a = await build();
    const b = await build();
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });
});

describe("water (shader pass)", () => {
  const hasGl = (() => {
    try {
      createRequire(import.meta.url).resolve("gl");
      return true;
    } catch {
      return false;
    }
  })();

  it.runIf(hasGl)("distorts pixels when GL is available", async () => {
    const plain = await (async () => {
      const { comp, seq } = makeComp();
      seq.add(new Rect({ x: 64, y: 64, width: 128, height: 128, fill: "#3366ff" }));
      const id = await frame(comp, 10);
      comp.destroy();
      return id;
    })();

    const { comp, seq } = makeComp();
    seq.add(
      new Rect({
        x: 64,
        y: 64,
        width: 128,
        height: 128,
        fill: "#3366ff",
        effects: [water({ waves: 0.8, edges: 1 })],
      }),
    );
    const distorted = await frame(comp, 10);
    expect(Buffer.from(plain.data).equals(Buffer.from(distorted.data))).toBe(false);
    comp.destroy();
  });

  it("skips the pass gracefully with no GL platform", async () => {
    setEffectShaderFactory(() => null);
    try {
      const { comp, seq } = makeComp();
      seq.add(
        new Rect({
          x: 64,
          y: 64,
          width: 128,
          height: 128,
          fill: "#3366ff",
          effects: [water(), shine({ progress: 0.5, angle: 0, intensity: 1 })],
        }),
      );
      const id = await frame(comp);
      // Water skipped, but the rest of the chain (shine) still applied and
      // the node still drew.
      expect(px(id, 128, 128)[3]).toBe(255);
      comp.destroy();
    } finally {
      setEffectShaderFactory(null); // restore default resolution
    }
  });
});
