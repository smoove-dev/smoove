import { describe, expect, it } from "vitest";
import { BlurEffect } from "../src/filters/blur.js";
import { ChromaticAberrationEffect } from "../src/filters/chromatic-aberration.js";
import { ColorKeyEffect } from "../src/filters/color-key.js";
import { GlowEffect } from "../src/filters/glow.js";
import { HeatmapEffect } from "../src/filters/heatmap.js";
import { HolographicEffect } from "../src/filters/holographic.js";
import { NeonEffect } from "../src/filters/neon.js";
import { NoiseGrainEffect } from "../src/filters/noise-grain.js";
import { PixelateEffect } from "../src/filters/pixelate.js";
import { PulseGlowEffect } from "../src/filters/pulse-glow.js";
import { ShineEffect } from "../src/filters/shine.js";
import { SparkleEffect } from "../src/filters/sparkle.js";
import { VignetteEffect } from "../src/filters/vignette.js";

const CTX = { frame: 0, time: 0, fps: 30, width: 100, height: 100, pixelRatio: 1 };

describe("BlurEffect", () => {
  it("emits two directional passes scaled by radius", () => {
    const e = new BlurEffect({ radius: 8 });
    const passes = e._kmPasses(CTX);
    expect(passes).toHaveLength(2);
    expect(passes[0]?.uniforms.u_direction).toEqual([8, 0]);
    expect(passes[1]?.uniforms.u_direction).toEqual([0, 8]);
  });
  it("honors horizontal/vertical toggles", () => {
    expect(new BlurEffect({ radius: 4, vertical: false })._kmPasses(CTX)).toHaveLength(1);
  });
});

describe("ColorKeyEffect", () => {
  it("maps color + thresholds to uniforms", () => {
    const e = new ColorKeyEffect({ color: "#00ff00", similarity: 0.4, smoothness: 0.1 });
    const u = e._kmPasses(CTX)[0]?.uniforms;
    expect(u?.u_keyColor).toEqual([0, 1, 0, 1]);
    expect(u?.u_similarity).toBe(0.4);
    expect(u?.u_smoothness).toBe(0.1);
  });
});

describe("PixelateEffect", () => {
  it("maps size to u_size", () => {
    expect(new PixelateEffect({ size: 12 })._kmPasses(CTX)[0]?.uniforms.u_size).toBe(12);
  });
});

describe("VignetteEffect", () => {
  it("maps params to uniforms", () => {
    const u = new VignetteEffect({
      amount: 0.5,
      radius: 0.8,
      softness: 0.2,
      color: "#ff0000",
    })._kmPasses(CTX)[0]?.uniforms;
    expect(u?.u_amount).toBe(0.5);
    expect(u?.u_radius).toBe(0.8);
    expect(u?.u_softness).toBe(0.2);
    expect(u?.u_color).toEqual([1, 0, 0, 1]);
  });
});

describe("ChromaticAberrationEffect", () => {
  it("maps amount and converts angle to radians", () => {
    const u = new ChromaticAberrationEffect({ amount: 6, angle: 90 })._kmPasses(CTX)[0]?.uniforms;
    expect(u?.u_amount).toBe(6);
    expect(u?.u_angle).toBeCloseTo(Math.PI / 2);
  });
});

describe("NoiseGrainEffect", () => {
  it("seeds from the frame when animated, pins to 0 when not", () => {
    const at = (frame: number, animated: boolean) =>
      new NoiseGrainEffect({ animated })._kmPasses({ ...CTX, frame })[0]?.uniforms.u_seed;
    expect(at(7, true)).toBe(7);
    expect(at(8, true)).toBe(8);
    expect(at(7, false)).toBe(0);
    expect(at(8, false)).toBe(0);
  });
});

describe("GlowEffect", () => {
  it("emits blur-H, blur-V, then a composite pass", () => {
    const passes = new GlowEffect({ radius: 10 })._kmPasses(CTX);
    expect(passes).toHaveLength(3);
    expect(passes[0]?.uniforms.u_direction).toEqual([10, 0]);
    expect(passes[1]?.uniforms.u_direction).toEqual([0, 10]);
    expect(passes[1]?.uniforms.u_threshold).toBe(0); // brightpass only on pass 1
    expect(passes[2]?.fragment).toContain("u_original");
  });
});

describe("ShineEffect", () => {
  it("maps params, converts angle, and scales u_time by speed", () => {
    const e = new ShineEffect({ angle: 90, width: 0.2, period: 4, speed: 2 });
    const u = e._kmPasses({ ...CTX, time: 1.5 })[0]?.uniforms;
    expect(u?.u_angle).toBeCloseTo(Math.PI / 2);
    expect(u?.u_width).toBe(0.2);
    expect(u?.u_period).toBe(4);
    expect(u?.u_time).toBe(3); // time × speed
  });
});

describe("NeonEffect", () => {
  it("emits blur-H, blur-V (no brightpass), then a composite pass", () => {
    const passes = new NeonEffect({ radius: 12 })._kmPasses(CTX);
    expect(passes).toHaveLength(3);
    expect(passes[0]?.uniforms.u_direction).toEqual([12, 0]);
    expect(passes[0]?.uniforms.u_threshold).toBe(0);
    expect(passes[1]?.uniforms.u_direction).toEqual([0, 12]);
    expect(passes[2]?.fragment).toContain("u_original");
  });
  it("keeps u_flicker at 1 when flicker is 0, and deterministic otherwise", () => {
    expect(new NeonEffect()._kmPasses({ ...CTX, time: 3.3 })[2]?.uniforms.u_flicker).toBe(1);
    const at = () =>
      new NeonEffect({ flicker: 0.8 })._kmPasses({ ...CTX, time: 3.3 })[2]?.uniforms.u_flicker;
    expect(at()).toBe(at()); // same clock → same flicker
    expect(at()).toBeLessThanOrEqual(1);
  });
});

describe("SparkleEffect", () => {
  it("maps grid and glint params to uniforms", () => {
    const u = new SparkleEffect({ density: 20, size: 6, intensity: 2 })._kmPasses(CTX)[0]?.uniforms;
    expect(u?.u_density).toBe(20);
    expect(u?.u_size).toBe(6);
    expect(u?.u_intensity).toBe(2);
  });
});

describe("HolographicEffect", () => {
  it("maps sheen params and converts angle to radians", () => {
    const u = new HolographicEffect({ scale: 5, angle: 180, saturation: 0.5 })._kmPasses(CTX)[0]
      ?.uniforms;
    expect(u?.u_scale).toBe(5);
    expect(u?.u_angle).toBeCloseTo(Math.PI);
    expect(u?.u_saturation).toBe(0.5);
  });
});

describe("PulseGlowEffect", () => {
  it("shares glow's pass chain and breathes u_intensity on the clock", () => {
    const e = new PulseGlowEffect({ radius: 10, intensity: 2, depth: 0.5, period: 2 });
    const at = (time: number) => e._kmPasses({ ...CTX, time })[2]?.uniforms.u_intensity as number;
    expect(e._kmPasses(CTX)).toHaveLength(3);
    expect(at(0)).toBeCloseTo(1); // dim end: intensity × (1 − depth)
    expect(at(1)).toBeCloseTo(2); // half period: full intensity
    expect(at(2)).toBeCloseTo(1); // full period: back to dim
  });
});

describe("HeatmapEffect", () => {
  it("maps the color ramp and shape params", () => {
    const u = new HeatmapEffect({
      colors: ["#000", "#fff"],
      contour: 12,
      angle: 90,
      offset: 0.25,
    })._kmPasses(CTX)[0]?.uniforms;
    expect(u?.u_colors).toEqual([
      [0, 0, 0, 1],
      [1, 1, 1, 1],
    ]);
    expect(u?.u_colorsCount).toBe(2);
    expect(u?.u_contour).toBe(12);
    expect(u?.u_angle).toBeCloseTo(Math.PI / 2);
    expect(u?.u_offset).toBe(0.25);
  });
});
