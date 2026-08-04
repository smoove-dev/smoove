import type { EffectFrameContext } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { blur } from "./blur.js";
import { BLUR_LENS_FRAG } from "./glsl/blur-lens.frag.js";

/**
 * A frame context standing in for a 640x384 capture at 1x holding a 640x360
 * node — the shape the pipeline actually hands over, because the region's size
 * is snapped up to a 32px bucket while the node's box is not.
 */
function frameContext(overrides: Partial<EffectFrameContext> = {}): EffectFrameContext {
  return {
    frame: 30,
    time: 1,
    fps: 30,
    width: 640,
    height: 384,
    contentRect: { x: 0, y: 0, width: 640, height: 360 },
    pixelRatio: 1,
    node: { attrs: {} } as unknown as EffectFrameContext["node"],
    contentVersion: 0,
    ...overrides,
  };
}

const fc = frameContext();

function filterOf(effect: ReturnType<typeof blur>, context = fc): string {
  const pass = effect.passes(context)[0];
  if (!pass || pass.kind !== "css") throw new Error("expected a css pass");
  return pass.filter;
}

function uniformsOf(effect: ReturnType<typeof blur>, context = fc) {
  const pass = effect.passes(context)[0];
  if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
  return pass.uniforms as Record<string, number | number[]>;
}

describe("blur", () => {
  it("carries the effect brand and is enabled by default", () => {
    const effect = blur();
    expect(effect._fxEffect).toBe(true);
    expect(effect.enabled()).toBe(true);
  });

  it("defaults to a modest gaussian", () => {
    const effect = blur();
    expect(effect.type).toBe("gaussian");
    expect(effect.radius).toBe(8);
    expect(effect.bloom).toBe(0.5);
    expect(effect.blades).toBe(0);
    expect(effect.bladeAngle).toBe(0);
  });

  it("accepts overrides", () => {
    const effect = blur({ type: "lens", radius: 32, bloom: 0.7, blades: 6, bladeAngle: 15 });
    expect(effect.type).toBe("lens");
    expect(effect.radius).toBe(32);
    expect(effect.bloom).toBe(0.7);
    expect(effect.blades).toBe(6);
    expect(effect.bladeAngle).toBe(15);
  });

  it("rejects a type it has no kernel for rather than quietly softening", () => {
    expect(() => blur({ type: "radial" as unknown as "lens" })).toThrow(/blur: type/);
  });

  it("clamps rather than throws, so an easing overshoot is safe", () => {
    const effect = blur();
    effect.radius = -5;
    expect(effect.radius).toBe(0);
    effect.radius = 500;
    expect(effect.radius).toBe(200);
    effect.bloom = 3;
    expect(effect.bloom).toBe(1);
    effect.blades = 20;
    expect(effect.blades).toBe(12);
    effect.bladeAngle = -900;
    expect(effect.bladeAngle).toBe(-360);
  });

  it("treats a blade count below three as a round aperture, not an error", () => {
    // An interpolate sweeping `blades` up from 0 passes through 1 and 2, and
    // there is no such thing as a two-sided iris.
    for (const blades of [0, 1, 2]) {
      const effect = blur({ type: "lens", blades });
      expect(effect.blades).toBe(blades);
      expect(uniformsOf(effect).u_blades).toBe(blades);
    }
  });

  it("rejects a non-finite parameter", () => {
    expect(() => blur({ radius: Number.NaN })).toThrow(/blur: radius/);
  });

  it("is off at radius 0, so a sharp node costs nothing", () => {
    expect(blur({ radius: 0 }).enabled()).toBe(false);
    expect(blur({ type: "lens", radius: 0 }).enabled()).toBe(false);
  });

  describe("gaussian", () => {
    it("runs one css pass and no shader", () => {
      const passes = blur({ radius: 24 }).passes(fc);
      expect(passes).toHaveLength(1);
      expect(passes[0]?.kind).toBe("css");
    });

    it("asks ctx.filter for half the radius, because a disc's sigma is R/2", () => {
      expect(filterOf(blur({ radius: 24 }))).toBe("blur(12px)");
    });

    it("scales into device px, so a 1x preview matches a 2x render", () => {
      const effect = blur({ radius: 24 });
      expect(filterOf(effect, frameContext({ pixelRatio: 2 }))).toBe("blur(24px)");
    });

    it("pads to four sigma, where the tail is no longer a visible rectangle", () => {
      expect(blur({ radius: 24 }).padding()).toBe(48);
    });
  });

  describe("lens", () => {
    it("runs one shader pass with no extra textures", () => {
      const passes = blur({ type: "lens", radius: 20 }).passes(fc);
      expect(passes).toHaveLength(1);
      const pass = passes[0];
      if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
      expect(pass.fragment).toBe(BLUR_LENS_FRAG);
      expect(pass.textures).toBeUndefined();
    });

    it("pads by the disc's own reach plus a couple of px for the dither", () => {
      expect(blur({ type: "lens", radius: 20 }).padding()).toBe(22);
    });

    it("scales the radius into device px", () => {
      const effect = blur({ type: "lens", radius: 20 });
      expect(uniformsOf(effect).u_radius).toBe(20);
      expect(uniformsOf(effect, frameContext({ pixelRatio: 2 })).u_radius).toBe(40);
    });

    it("hands the shader radians, not the degrees the param is set in", () => {
      const u = uniformsOf(blur({ type: "lens", blades: 6, bladeAngle: 90 }));
      expect(u.u_bladeAngle).toBeCloseTo(Math.PI / 2, 10);
    });

    it("anchors the dither to the node's box, not the bucketed region", () => {
      const u = uniformsOf(
        blur({ type: "lens" }),
        frameContext({ contentRect: { x: 4, y: 6, width: 320, height: 180 } }),
      );
      expect(u.u_resolution).toEqual([640, 384]);
      expect(u.u_contentOrigin).toEqual([4, 6]);
    });

    it("carries every scalar the shader reads", () => {
      const u = uniformsOf(blur({ type: "lens", bloom: 0.25 }));
      expect(u.u_bloom).toBe(0.25);
      for (const name of ["u_radius", "u_blades", "u_bladeAngle"]) {
        expect(u[name], `missing uniform ${name}`).toBeTypeOf("number");
      }
    });

    it("does not depend on the frame at all", () => {
      const effect = blur({ type: "lens" });
      const a = uniformsOf(effect, frameContext({ frame: 0, time: 0 }));
      const b = uniformsOf(effect, frameContext({ frame: 300, time: 10 }));
      expect(b).toEqual(a);
    });
  });

  it("switches kernel without changing how much blur is asked for", () => {
    // The whole point of normalizing radius: flipping type changes the
    // character, not the amount, so no docs example needs re-tuning.
    const effect = blur({ radius: 30 });
    expect(filterOf(effect)).toBe("blur(15px)");
    effect.type = "lens";
    expect(uniformsOf(effect).u_radius).toBe(30);
    expect(effect.radius).toBe(30);
  });

  it("invalidates its nodes when a param or the type changes", () => {
    const effect = blur();
    let invalidated = 0;
    const node = { _fxInvalidate: () => invalidated++ };
    effect.attach(node as unknown as Parameters<typeof effect.attach>[0]);

    effect.radius = 12;
    expect(invalidated).toBe(1);
    effect.type = "lens";
    expect(invalidated).toBe(2);

    effect.detach(node as unknown as Parameters<typeof effect.detach>[0]);
    effect.bloom = 0.2;
    expect(invalidated).toBe(2);
  });
});
