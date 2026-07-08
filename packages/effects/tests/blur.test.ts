import type { EffectFrameContext } from "@smoove/core";
import { beforeEach, describe, expect, it } from "vitest";
import { blur } from "../src/blur.js";
import { setCtxFilterSupport } from "../src/support.js";

const fc: EffectFrameContext = { frame: 0, time: 0, fps: 30, width: 64, height: 64, pixelRatio: 2 };

describe("blur", () => {
  beforeEach(() => setCtxFilterSupport(undefined));

  it("emits one css pass scaled by pixelRatio when ctx.filter is supported", () => {
    setCtxFilterSupport(true);
    const fx = blur({ radius: 8 });
    const passes = fx.passes(fc);
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ kind: "css", filter: "blur(16px)" });
  });

  it("changes its key when radius changes", () => {
    setCtxFilterSupport(true);
    const fx = blur({ radius: 8 });
    const k0 = fx.passes(fc)[0].key;
    fx.radius = 12;
    expect(fx.passes(fc)[0].key).not.toBe(k0);
  });

  it("declares padding of 2x radius", () => {
    const fx = blur({ radius: 10 });
    expect(fx.padding(fc)).toBe(20);
  });

  it("falls back to a pixels pass that actually spreads pixels", () => {
    setCtxFilterSupport(false);
    const fx = blur({ radius: 2 });
    const passes = fx.passes(fc);
    expect(passes[0].kind).toBe("pixels");
    // 8x8 impulse image: center pixel white, rest black.
    const w = 8;
    const data = new Uint8ClampedArray(w * w * 4);
    const c = (4 * w + 4) * 4;
    data[c] = data[c + 1] = data[c + 2] = data[c + 3] = 255;
    if (passes[0].kind === "pixels") passes[0].run(data, w, w);
    const neighbor = (4 * w + 5) * 4;
    expect(data[neighbor + 3]).toBeGreaterThan(0); // alpha spread to the neighbor
    expect(data[c + 3]).toBeLessThan(255); // center attenuated
  });
});
