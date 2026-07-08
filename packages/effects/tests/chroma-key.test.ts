import type { EffectFrameContext } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { chromaKey } from "../src/chroma-key.js";

const fc: EffectFrameContext = { frame: 0, time: 0, fps: 30, width: 2, height: 2, pixelRatio: 1 };

function px(r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a]);
}

function runOn(data: Uint8ClampedArray): Uint8ClampedArray {
  const fx = chromaKey();
  const pass = fx.passes(fc)[0];
  if (pass.kind !== "pixels") throw new Error("expected pixels pass");
  pass.run(data, 1, data.length / 4);
  return data;
}

describe("chromaKey", () => {
  it("keys out green-screen green fully", () => {
    expect(runOn(px(0, 177, 64))[3]).toBe(0);
  });

  it("keeps red fully opaque", () => {
    expect(runOn(px(230, 60, 60))[3]).toBe(255);
  });

  it("keeps white fully opaque", () => {
    expect(runOn(px(255, 255, 255))[3]).toBe(255);
  });

  it("ramps alpha in the smoothness band", () => {
    // A desaturated green (chroma distance ~64 from the key) sits between the
    // cut radius (45) and the keep zone (70+).
    const a = runOn(px(140, 180, 120))[3];
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
  });

  it("key changes when the color changes", () => {
    const fx = chromaKey();
    const k0 = fx.passes(fc)[0].key;
    fx.color = "#0000ff";
    expect(fx.passes(fc)[0].key).not.toBe(k0);
  });
});
