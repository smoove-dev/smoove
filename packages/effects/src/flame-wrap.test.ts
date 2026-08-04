import type { EffectFrameContext } from "@smoove/core";
import { describe, expect, it, vi } from "vitest";
import { flameWrap } from "./flame-wrap.js";
import { FLAME_WRAP_FRAG, FLAME_WRAP_SILHOUETTE_FRAG } from "./glsl/flame-wrap.frag.js";

/** A frame context standing in for a 256x256 capture at 1x, frame 30 of 30fps. */
function frameContext(overrides: Partial<EffectFrameContext> = {}): EffectFrameContext {
  return {
    frame: 30,
    time: 1,
    fps: 30,
    width: 256,
    height: 256,
    contentRect: { x: 48, y: 48, width: 160, height: 160 },
    pixelRatio: 1,
    node: { attrs: {} } as unknown as EffectFrameContext["node"],
    contentVersion: 0,
    ...overrides,
  };
}

const fc = frameContext();

function uniformsOf(effect: ReturnType<typeof flameWrap>, context = fc) {
  const pass = effect.passes(context)[0];
  if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
  return pass.uniforms as Record<string, number | number[]>;
}

function paddingOf(effect: ReturnType<typeof flameWrap>, context = fc) {
  const padding = effect.padding?.(context);
  if (typeof padding !== "object") throw new Error("expected per-side padding");
  return padding;
}

describe("flameWrap", () => {
  it("carries the effect brand and is enabled by default", () => {
    const effect = flameWrap();
    expect(effect._fxEffect).toBe(true);
    expect(effect.enabled()).toBe(true);
  });

  it("is disabled at zero intensity, so it costs nothing before ignition", () => {
    expect(flameWrap({ intensity: 0 }).enabled()).toBe(false);
  });

  it("applies the reference defaults", () => {
    const effect = flameWrap();
    expect(effect.height).toBe(170);
    expect(effect.spread).toBe(8);
    expect(effect.radius).toBe(40);
    expect(effect.intensity).toBe(0.5);
    expect(effect.speed).toBe(0.25);
    expect(effect.color).toEqual([0.31, 0.54, 1]);
  });

  it("accepts overrides", () => {
    const effect = flameWrap({ height: 100, intensity: 2, color: [0, 0.5, 1] });
    expect(effect.height).toBe(100);
    expect(effect.intensity).toBe(2);
    expect(effect.color).toEqual([0, 0.5, 1]);
  });

  it("pads asymmetrically: flames climb, glow only spreads", () => {
    const padding = paddingOf(flameWrap({ height: 100, spread: 10, melt: 0 }));
    expect(padding.top).toBe(125);
    expect(padding.right).toBe(36);
    expect(padding.bottom).toBe(36);
    expect(padding.left).toBe(36);
  });

  it("grows the padding with melt, which eats past the outline", () => {
    const padding = paddingOf(flameWrap({ height: 100, spread: 10, melt: 8 }));
    expect(padding.top).toBe(133);
    expect(padding.right).toBe(44);
  });

  it("scales padding by pixelRatio", () => {
    const effect = flameWrap({ height: 100, spread: 10, melt: 0 });
    expect(paddingOf(effect, frameContext({ pixelRatio: 2 })).top).toBe(250);
  });

  it("emits exactly one shader pass", () => {
    const passes = flameWrap().passes(fc);
    expect(passes).toHaveLength(1);
    expect(passes[0]?.kind).toBe("shader");
  });

  it("drives u_time from the frame clock", () => {
    expect(uniformsOf(flameWrap()).u_time).toBe(1);
    expect(uniformsOf(flameWrap(), frameContext({ frame: 60, time: 2 })).u_time).toBe(2);
  });

  it("is pure in fc: the same context yields identical uniforms", () => {
    const effect = flameWrap();
    expect(uniformsOf(effect)).toEqual(uniformsOf(effect));
  });

  it("converts px params to device px in uniforms", () => {
    const effect = flameWrap({ height: 100, distortion: 10 });
    const at2x = uniformsOf(effect, frameContext({ pixelRatio: 2 }));
    expect(at2x.u_height).toBe(200);
    expect(at2x.u_distortion).toBe(20);
  });

  it("leaves unitless params alone at 2x", () => {
    const effect = flameWrap({ intensity: 0.8, turbulence: 0.5 });
    const at2x = uniformsOf(effect, frameContext({ pixelRatio: 2 }));
    expect(at2x.u_intensity).toBe(0.8);
    expect(at2x.u_turbulence).toBe(0.5);
  });

  it("passes the region resolution through", () => {
    const uniforms = uniformsOf(flameWrap(), frameContext({ width: 320, height: 240 }));
    expect(uniforms.u_resolution).toEqual([320, 240]);
  });

  it("places the burning box where the node sits in the region, y flipped", () => {
    // A 160x160 node at (48, 48) of a 256x256 region: centred horizontally, and
    // its centre is 128 px up from the region's bottom edge.
    const uniforms = uniformsOf(flameWrap());
    expect(uniforms.u_rectCenter).toEqual([128, 128]);
    expect(uniforms.u_rectHalf).toEqual([80, 80]);
  });

  it("follows the node's box when it is off-centre in the region", () => {
    const uniforms = uniformsOf(
      flameWrap(),
      frameContext({
        width: 400,
        height: 300,
        contentRect: { x: 40, y: 20, width: 200, height: 100 },
      }),
    );
    expect(uniforms.u_rectCenter).toEqual([140, 230]);
    expect(uniforms.u_rectHalf).toEqual([100, 50]);
  });

  it("scales the corner radius into device px", () => {
    const at2x = uniformsOf(flameWrap({ radius: 28 }), frameContext({ pixelRatio: 2 }));
    expect(at2x.u_radius).toBe(56);
  });

  it("declares a uniform for every parameter", () => {
    const uniforms = uniformsOf(flameWrap());
    for (const name of [
      "u_color",
      "u_intensity",
      "u_height",
      "u_spread",
      "u_radius",
      "u_speed",
      "u_scale",
      "u_turbulence",
      "u_turbulenceScale",
      "u_turbulenceReach",
      "u_sparks",
      "u_sparkSize",
      "u_sparkDensity",
      "u_sparkSpeed",
      "u_rim",
      "u_melt",
      "u_distortion",
      "u_smoke",
      "u_ember",
      "u_scorch",
    ]) {
      expect(uniforms, `missing ${name}`).toHaveProperty(name);
    }
  });

  it("rejects a colour that is not three numbers", () => {
    expect(() => flameWrap({ color: [1, 0] as unknown as [number, number, number] })).toThrow(
      /color/i,
    );
  });

  it("rejects a non-finite param", () => {
    expect(() => flameWrap({ height: Number.NaN })).toThrow(/height/i);
  });

  it("clamps an out-of-range param instead of throwing", () => {
    expect(flameWrap({ intensity: 99 }).intensity).toBe(3);
    expect(flameWrap({ intensity: -5 }).intensity).toBe(0);
  });

  it("clamps on assignment too, so an interpolate overshoot is safe", () => {
    const effect = flameWrap();
    effect.intensity = 99;
    expect(effect.intensity).toBe(3);
  });

  it("invalidates every attached node when a param is set", () => {
    const effect = flameWrap();
    const invalidate = vi.fn();
    const node = { _fxInvalidate: invalidate } as unknown as EffectFrameContext["node"];
    effect.attach(node);
    effect.intensity = 1.2;
    expect(invalidate).toHaveBeenCalled();
  });

  it("stops invalidating after detach", () => {
    const effect = flameWrap();
    const invalidate = vi.fn();
    const node = { _fxInvalidate: invalidate } as unknown as EffectFrameContext["node"];
    effect.attach(node);
    effect.detach(node);
    invalidate.mockClear();
    effect.intensity = 1.5;
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("wraps the box by default, needing no texture beyond the capture", () => {
    const effect = flameWrap();
    expect(effect.shape).toBe("box");
    const pass = effect.passes(fc)[0];
    if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
    expect(pass.fragment).toBe(FLAME_WRAP_FRAG);
    expect(pass.textures).toBeUndefined();
  });

  it("switches to the silhouette fragment and asks for the distance field", () => {
    const effect = flameWrap({ shape: "silhouette" });
    expect(effect.shape).toBe("silhouette");
    const pass = effect.passes(fc)[0];
    if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
    expect(pass.fragment).toBe(FLAME_WRAP_SILHOUETTE_FRAG);
    expect(typeof pass.textures).toBe("function");
  });

  it("follows the shape set after construction", () => {
    const effect = flameWrap();
    effect.shape = "silhouette";
    const pass = effect.passes(fc)[0];
    if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
    expect(pass.fragment).toBe(FLAME_WRAP_SILHOUETTE_FRAG);
  });

  it("rejects a shape it does not have", () => {
    expect(() => flameWrap({ shape: "glyphs" as unknown as "box" })).toThrow(/shape/i);
  });
});
