import type { EffectFrameContext } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { water } from "../src/water.js";

const fc: EffectFrameContext = {
  frame: 30,
  time: 1,
  fps: 30,
  width: 128,
  height: 64,
  pixelRatio: 1,
};

describe("water", () => {
  it("emits one shader pass with the vendored fragment and mapped uniforms", () => {
    const fx = water({ waves: 0.5, caustic: 0.2 });
    const pass = fx.passes(fc)[0];
    if (pass.kind !== "shader") throw new Error("expected shader pass");
    expect(pass.fragment).toContain("u_texture");
    expect(pass.uniforms.u_waves).toBe(0.5);
    expect(pass.uniforms.u_caustic).toBe(0.2);
    expect(pass.uniforms.u_colorBack).toEqual([0, 0, 0, 0]);
  });

  it("scales u_time by speed", () => {
    const fx = water({ speed: 2 });
    const pass = fx.passes(fc)[0];
    if (pass.kind !== "shader") throw new Error("expected shader pass");
    expect(pass.uniforms.u_time).toBe(2); // time 1s * speed 2
  });

  it("keys change over time (animated water never serves a stale cache)", () => {
    const fx = water();
    const k0 = fx.passes(fc)[0].key;
    const k1 = fx.passes({ ...fc, frame: 31, time: 31 / 30 })[0].key;
    expect(k1).not.toBe(k0);
  });

  it("declares displacement padding", () => {
    expect(water().padding(fc)).toBe(40);
  });
});
