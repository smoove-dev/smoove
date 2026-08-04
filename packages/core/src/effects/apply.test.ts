import { describe, expect, it } from "vitest";
import { captureRegion, coalesce } from "./apply.js";
import type { EffectPass } from "./contract.js";

describe("captureRegion", () => {
  it("pads per side and rounds the size up to 32px buckets", () => {
    const r = captureRegion(
      { x: 100, y: 50, width: 200, height: 40 },
      { top: 170, right: 8, bottom: 8, left: 8 },
      1,
    );
    // origin: 100-8=92, 50-170=-120. size: 216x218 -> 224x224.
    expect(r).toEqual({ x: 92, y: -120, width: 224, height: 224 });
  });

  it("scales geometry and padding by pixelRatio", () => {
    const r = captureRegion(
      { x: 0, y: 0, width: 100, height: 100 },
      { top: 10, right: 10, bottom: 10, left: 10 },
      2,
    );
    // origin: -20. size: 240x240 -> 256x256 (240 is not a multiple of 32).
    expect(r).toEqual({ x: -20, y: -20, width: 256, height: 256 });
  });

  it("is stable across sub-bucket size changes, so pooled textures survive", () => {
    const pad = { top: 0, right: 0, bottom: 0, left: 0 };
    const a = captureRegion({ x: 0, y: 0, width: 100, height: 100 }, pad, 1);
    const b = captureRegion({ x: 0, y: 0, width: 110, height: 110 }, pad, 1);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
  });

  it("handles zero padding", () => {
    const r = captureRegion(
      { x: 10, y: 20, width: 64, height: 64 },
      { top: 0, right: 0, bottom: 0, left: 0 },
      1,
    );
    expect(r).toEqual({ x: 10, y: 20, width: 64, height: 64 });
  });

  it("floors a fractional origin so the blit lands on a pixel", () => {
    const r = captureRegion(
      { x: 10.7, y: 20.2, width: 64, height: 64 },
      { top: 0, right: 0, bottom: 0, left: 0 },
      1,
    );
    expect(r.x).toBe(10);
    expect(r.y).toBe(20);
  });

  it("never returns a zero-size region", () => {
    const r = captureRegion(
      { x: 0, y: 0, width: 0, height: 0 },
      { top: 0, right: 0, bottom: 0, left: 0 },
      1,
    );
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

describe("coalesce", () => {
  const css = (filter: string): EffectPass => ({ kind: "css", filter });
  const pixels = (): EffectPass => ({ kind: "pixels", run: () => {} });
  const composite = (): EffectPass => ({ kind: "composite", run: () => {} });
  const shader = (): EffectPass => ({ kind: "shader", fragment: "f", uniforms: {} });

  it("joins consecutive css passes into one filter string", () => {
    const groups = coalesce([css("blur(2px)"), css("brightness(1.2)")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "css", filter: "blur(2px) brightness(1.2)" });
  });

  it("groups consecutive pixels passes into one round trip", () => {
    const groups = coalesce([pixels(), pixels()]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("pixels");
    expect((groups[0] as { passes: unknown[] }).passes).toHaveLength(2);
  });

  it("preserves author order across kinds", () => {
    const groups = coalesce([pixels(), css("blur(1px)"), composite(), shader()]);
    expect(groups.map((g) => g.kind)).toEqual(["pixels", "css", "composite", "shader"]);
  });

  it("does not merge css passes separated by another kind", () => {
    const groups = coalesce([css("blur(1px)"), composite(), css("blur(2px)")]);
    expect(groups.map((g) => g.kind)).toEqual(["css", "composite", "css"]);
    expect(groups[0]).toMatchObject({ filter: "blur(1px)" });
    expect(groups[2]).toMatchObject({ filter: "blur(2px)" });
  });

  it("returns nothing for an empty chain", () => {
    expect(coalesce([])).toEqual([]);
  });

  it("keeps a lone shader pass intact", () => {
    const groups = coalesce([shader()]);
    expect(groups).toHaveLength(1);
    expect((groups[0] as { passes: unknown[] }).passes).toHaveLength(1);
  });
});
