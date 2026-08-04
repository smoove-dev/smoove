import type { EffectFrameContext } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { droplets } from "./droplets.js";
import { DROPLETS_FRAG } from "./glsl/droplets.frag.js";

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

function uniformsOf(effect: ReturnType<typeof droplets>, context = fc) {
  const pass = effect.passes(context)[0];
  if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
  return pass.uniforms as Record<string, number | number[]>;
}

describe("droplets", () => {
  it("carries the effect brand and is enabled by default", () => {
    const effect = droplets();
    expect(effect._fxEffect).toBe(true);
    expect(effect.enabled()).toBe(true);
  });

  it("applies the reference defaults", () => {
    const effect = droplets();
    expect(effect.intensity).toBe(0.5);
    // Not the reference's 0.4: drop size is measured in CSS px here, where the
    // reference measured device px, so matching its retina picture takes more.
    expect(effect.scale).toBe(0.7);
    expect(effect.refraction).toBe(0.2);
    expect(effect.staticDrops).toBe(0.2);
    expect(effect.fallSpeed).toBe(1);
    expect(effect.tint).toEqual([1, 1, 1]);
  });

  it("accepts overrides", () => {
    const effect = droplets({ intensity: 1.1, blur: 8, tint: [0.6, 0.7, 1] });
    expect(effect.intensity).toBe(1.1);
    expect(effect.blur).toBe(8);
    expect(effect.tint).toEqual([0.6, 0.7, 1]);
  });

  it("clamps rather than throws, so an easing overshoot is safe", () => {
    const effect = droplets();
    effect.intensity = 4;
    expect(effect.intensity).toBe(1.25);
    effect.intensity = -2;
    expect(effect.intensity).toBe(0);
    effect.scale = 0;
    expect(effect.scale).toBe(0.02);
  });

  it("rejects a non-finite parameter", () => {
    expect(() => droplets({ intensity: Number.NaN })).toThrow(/droplets: intensity/);
  });

  it("rejects a malformed tint", () => {
    expect(() => droplets({ tint: [1, 0] as unknown as [number, number, number] })).toThrow(
      /droplets: tint/,
    );
  });

  describe("enabled", () => {
    it("is off with no rain and no glass treatment, so it costs nothing", () => {
      expect(droplets({ intensity: 0 }).enabled()).toBe(false);
    });

    it("stays on for fog, vignette or tint without rain", () => {
      expect(droplets({ intensity: 0, blur: 6 }).enabled()).toBe(true);
      expect(droplets({ intensity: 0, vignette: 0.4 }).enabled()).toBe(true);
      expect(droplets({ intensity: 0, tintStrength: 0.3 }).enabled()).toBe(true);
    });
  });

  it("asks for no padding: the water never leaves the node's box", () => {
    expect(droplets().padding).toBeUndefined();
  });

  it("runs one shader pass with no extra textures", () => {
    const passes = droplets().passes(fc);
    expect(passes).toHaveLength(1);
    const pass = passes[0];
    if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
    expect(pass.fragment).toBe(DROPLETS_FRAG);
    expect(pass.textures).toBeUndefined();
  });

  describe("uniforms", () => {
    it("places the glass on the node's box, not the bucketed region", () => {
      const u = uniformsOf(
        droplets(),
        frameContext({ contentRect: { x: 4, y: 6, width: 320, height: 180 } }),
      );
      expect(u.u_resolution).toEqual([640, 384]);
      expect(u.u_contentOrigin).toEqual([4, 6]);
      expect(u.u_contentSize).toEqual([320, 180]);
    });

    it("passes time straight from the frame clock", () => {
      expect(uniformsOf(droplets(), frameContext({ frame: 90, time: 3 })).u_time).toBe(3);
    });

    it("scales px-valued params into device px so 1x and 2x match", () => {
      const effect = droplets({ blur: 6 });
      expect(uniformsOf(effect).u_blur).toBe(6);
      expect(uniformsOf(effect, frameContext({ pixelRatio: 2 })).u_blur).toBe(12);
    });

    it("keeps drop size in CSS px, so a 2x render is not a bigger downpour", () => {
      const effect = droplets();
      const at1x = uniformsOf(
        effect,
        frameContext({ contentRect: { x: 0, y: 0, width: 1280, height: 720 } }),
      );
      const at2x = uniformsOf(
        effect,
        frameContext({
          pixelRatio: 2,
          contentRect: { x: 0, y: 0, width: 2560, height: 1440 },
        }),
      );
      expect(at2x.u_sizeRef).toBe(at1x.u_sizeRef);
      expect(at1x.u_sizeRef).toBeCloseTo(0.8, 6);
    });

    it("clamps the drop-size reference so tiny and huge nodes stay sane", () => {
      const effect = droplets();
      const tiny = uniformsOf(
        effect,
        frameContext({ contentRect: { x: 0, y: 0, width: 120, height: 80 } }),
      );
      const huge = uniformsOf(
        effect,
        frameContext({ contentRect: { x: 0, y: 0, width: 4000, height: 3000 } }),
      );
      expect(tiny.u_sizeRef).toBe(0.75);
      expect(huge.u_sizeRef).toBe(1.35);
    });

    it("carries the tint and every scalar the shader reads", () => {
      const u = uniformsOf(droplets({ tint: [0.2, 0.4, 0.9], tintStrength: 0.5 }));
      expect(u.u_tint).toEqual([0.2, 0.4, 0.9]);
      expect(u.u_tintStrength).toBe(0.5);
      for (const name of [
        "u_intensity",
        "u_speed",
        "u_scale",
        "u_dropWidth",
        "u_dropLength",
        "u_refraction",
        "u_vignette",
        "u_fallSpeed",
        "u_wiggle",
        "u_staticDrops",
        "u_sheen",
      ]) {
        expect(u[name], `missing uniform ${name}`).toBeTypeOf("number");
      }
    });

    it("depends on the frame only through u_time", () => {
      const effect = droplets();
      const a = uniformsOf(effect, frameContext({ frame: 0, time: 0 }));
      const b = uniformsOf(effect, frameContext({ frame: 300, time: 10 }));
      expect({ ...a, u_time: 0 }).toEqual(a);
      expect({ ...b, u_time: 0 }).toEqual({ ...a });
    });
  });

  it("invalidates its nodes when a param or the tint changes", () => {
    const effect = droplets();
    let invalidated = 0;
    const node = { _fxInvalidate: () => invalidated++ };
    effect.attach(node as unknown as Parameters<typeof effect.attach>[0]);

    effect.intensity = 1;
    expect(invalidated).toBe(1);
    effect.tint = [0, 0, 0];
    expect(invalidated).toBe(2);

    effect.detach(node as unknown as Parameters<typeof effect.detach>[0]);
    effect.intensity = 0.2;
    expect(invalidated).toBe(2);
  });
});
