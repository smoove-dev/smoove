import type { EffectFrameContext } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { chromaKey } from "./chroma-key.js";
import { CHROMA_KEY_FRAG } from "./glsl/chroma-key.frag.js";

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

function uniformsOf(effect: ReturnType<typeof chromaKey>, context = fc) {
  const pass = effect.passes(context)[0];
  if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
  return pass.uniforms as Record<string, number | number[]>;
}

describe("chromaKey", () => {
  it("carries the effect brand and is enabled by default", () => {
    const effect = chromaKey();
    expect(effect._fxEffect).toBe(true);
    expect(effect.enabled()).toBe(true);
  });

  it("defaults to a full-strength green key half the way to neutral", () => {
    const effect = chromaKey();
    expect(effect.strength).toBe(1);
    expect(effect.color).toEqual([0, 1, 0]);
    expect(effect.similarity).toBe(0.5);
    expect(effect.smoothness).toBe(0.15);
    expect(effect.choke).toBe(0);
  });

  it("will not let similarity reach neutral, which would key the subject's greys", () => {
    const effect = chromaKey();
    effect.similarity = 1;
    expect(effect.similarity).toBe(0.95);
  });

  it("accepts overrides", () => {
    const effect = chromaKey({ similarity: 0.55, spill: 0.2, choke: 1.5 });
    expect(effect.similarity).toBe(0.55);
    expect(effect.spill).toBe(0.2);
    expect(effect.choke).toBe(1.5);
  });

  describe("color", () => {
    it("takes the hex an eyedropper gives, in either length", () => {
      expect(chromaKey({ color: "#3ea346" }).color).toEqual([62 / 255, 163 / 255, 70 / 255]);
      expect(chromaKey({ color: "0f0" }).color).toEqual([0, 1, 0]);
    });

    it("takes a triplet too", () => {
      expect(chromaKey({ color: [0.1, 0.6, 0.2] }).color).toEqual([0.1, 0.6, 0.2]);
    });

    it("rejects a colour it cannot parse rather than keying on something else", () => {
      expect(() => chromaKey({ color: "green" })).toThrow(/chromaKey: color/);
      expect(() => chromaKey({ color: "#12345" })).toThrow(/chromaKey: color/);
      expect(() => chromaKey({ color: [1, 0] as unknown as [number, number, number] })).toThrow(
        /chromaKey: color/,
      );
    });

    it("parses on assignment as well as construction", () => {
      const effect = chromaKey();
      effect.color = "#0000ff";
      expect(effect.color).toEqual([0, 0, 1]);
    });
  });

  it("clamps rather than throws, so an easing overshoot is safe", () => {
    const effect = chromaKey();
    effect.strength = 3;
    expect(effect.strength).toBe(1);
    effect.strength = -1;
    expect(effect.strength).toBe(0);
    effect.choke = 40;
    expect(effect.choke).toBe(8);
    effect.choke = -40;
    expect(effect.choke).toBe(-8);
  });

  it("rejects a non-finite parameter", () => {
    expect(() => chromaKey({ similarity: Number.NaN })).toThrow(/chromaKey: similarity/);
  });

  it("is off at strength 0, so an unkeyed clip costs nothing", () => {
    expect(chromaKey({ strength: 0 }).enabled()).toBe(false);
  });

  it("asks for no padding: keying only takes pixels away", () => {
    expect(chromaKey().padding).toBeUndefined();
  });

  it("runs one shader pass with no extra textures", () => {
    const passes = chromaKey().passes(fc);
    expect(passes).toHaveLength(1);
    const pass = passes[0];
    if (!pass || pass.kind !== "shader") throw new Error("expected a shader pass");
    expect(pass.fragment).toBe(CHROMA_KEY_FRAG);
    expect(pass.textures).toBeUndefined();
  });

  describe("uniforms", () => {
    it("keys the node's box, not the bucketed region", () => {
      const u = uniformsOf(
        chromaKey(),
        frameContext({ contentRect: { x: 4, y: 6, width: 320, height: 180 } }),
      );
      expect(u.u_resolution).toEqual([640, 384]);
      expect(u.u_contentOrigin).toEqual([4, 6]);
      expect(u.u_contentSize).toEqual([320, 180]);
    });

    it("carries the key colour and every scalar the shader reads", () => {
      const u = uniformsOf(chromaKey({ color: "#3ea346", spill: 0.25 }));
      expect(u.u_key).toEqual([62 / 255, 163 / 255, 70 / 255]);
      expect(u.u_spill).toBe(0.25);
      for (const name of ["u_strength", "u_similarity", "u_smoothness", "u_choke"]) {
        expect(u[name], `missing uniform ${name}`).toBeTypeOf("number");
      }
    });

    it("scales the choke into device px so 1x and 2x cut the same edge", () => {
      const effect = chromaKey({ choke: 2 });
      expect(uniformsOf(effect).u_choke).toBe(2);
      expect(uniformsOf(effect, frameContext({ pixelRatio: 2 })).u_choke).toBe(4);
    });

    it("does not depend on the frame at all", () => {
      const effect = chromaKey();
      const a = uniformsOf(effect, frameContext({ frame: 0, time: 0 }));
      const b = uniformsOf(effect, frameContext({ frame: 300, time: 10 }));
      expect(b).toEqual(a);
    });
  });

  it("invalidates its nodes when a param or the colour changes", () => {
    const effect = chromaKey();
    let invalidated = 0;
    const node = { _fxInvalidate: () => invalidated++ };
    effect.attach(node as unknown as Parameters<typeof effect.attach>[0]);

    effect.similarity = 0.5;
    expect(invalidated).toBe(1);
    effect.color = "#00ff00";
    expect(invalidated).toBe(2);

    effect.detach(node as unknown as Parameters<typeof effect.detach>[0]);
    effect.strength = 0.2;
    expect(invalidated).toBe(2);
  });
});
