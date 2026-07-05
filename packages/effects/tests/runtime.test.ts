import { describe, expect, it } from "vitest";
import { EffectRuntime } from "../src/runtime/runtime.js";
import { createTestPlatform, solid } from "./util/test-platform.js";

const platform = createTestPlatform();
// Safe inside describe.skipIf(!platform): the suite doesn't run when null.
const p = platform as NonNullable<typeof platform>;

// Identity: sample input untouched.
const IDENTITY = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 fragColor;
void main() { fragColor = texture(u_texture, v_uv); }`;

// Channel swap: prove uniforms + chaining (red→green when u_swap=1).
const SWAP = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_swap;
out vec4 fragColor;
void main() {
	vec4 c = texture(u_texture, v_uv);
	fragColor = mix(c, c.grba, u_swap);
}`;

describe.skipIf(!platform)("EffectRuntime", () => {
  it("identity pass returns the input pixels", () => {
    const rt = new EffectRuntime(p);
    rt.applyChain(
      solid(255, 0, 0, 255) as unknown as CanvasImageSource,
      [{ fragment: IDENTITY, uniforms: {} }],
      4,
      4,
    );
    const px = p.readPixels();
    expect([px[0], px[1], px[2], px[3]]).toEqual([255, 0, 0, 255]);
  });

  it("chains two passes through the ping-pong FBOs", () => {
    const rt = new EffectRuntime(p);
    rt.applyChain(
      solid(255, 0, 0, 255) as unknown as CanvasImageSource,
      [
        // c.grba swaps R↔G: (255,0,0) → (0,255,0) → (255,0,0). Two passes
        // round-trip, proving the FBO ping-pong feeds pass 2 from pass 1.
        { fragment: SWAP, uniforms: { u_swap: 1 } },
        { fragment: SWAP, uniforms: { u_swap: 1 } },
      ],
      4,
      4,
    );
    const px = p.readPixels();
    expect([px[0], px[1], px[2], px[3]]).toEqual([255, 0, 0, 255]);
  });

  it("renderSource draws without an input texture", () => {
    const rt = new EffectRuntime(p);
    const FLAT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec4 u_color;
out vec4 fragColor;
void main() { fragColor = u_color; }`;
    rt.renderSource({ fragment: FLAT, uniforms: { u_color: [0, 0, 1, 1] } }, 4, 4);
    const px = p.readPixels();
    expect([px[0], px[1], px[2], px[3]]).toEqual([0, 0, 255, 255]);
  });

  it("colorKey keys out a green input", async () => {
    const { ColorKeyEffect } = await import("../src/filters/color-key.js");
    const rt = new EffectRuntime(p);
    const e = new ColorKeyEffect({ color: "#00ff00" });
    const ctx = { frame: 0, time: 0, fps: 30, width: 4, height: 4, pixelRatio: 1 };
    rt.applyChain(solid(0, 255, 0, 255) as unknown as CanvasImageSource, e._kmPasses(ctx), 4, 4);
    const px = p.readPixels();
    expect(px[3]).toBe(0); // fully transparent
  });

  it("vendored source shaders compile and render on WebGL1", async () => {
    const SKIP_WEBGL1 = new Set<string>();
    const vendor = import.meta.glob("../src/glsl/vendor/*.ts") as Record<
      string,
      () => Promise<Record<string, string>>
    >;
    const rt = new EffectRuntime(p);
    const neutral = {
      u_time: 0.5,
      u_pixelRatio: 1,
      u_scale: 1,
      u_colors: [
        [1, 0, 0, 1],
        [0, 0, 1, 1],
      ],
      u_colorsCount: 2,
      u_colorBack: [0, 0, 0, 1],
      u_colorFront: [1, 1, 0, 1],
      u_count: 7,
      u_size: 0.75,
    };
    let tested = 0;
    for (const [path, load] of Object.entries(vendor)) {
      const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.ts$/, "");
      if (SKIP_WEBGL1.has(name)) continue;
      const mod = await load();
      const fragment = Object.values(mod)[0] as string;
      const out = rt.renderSource({ fragment, uniforms: neutral }, 8, 8);
      expect(out, name).not.toBeNull();
      tested++;
    }
    expect(tested).toBeGreaterThanOrEqual(20); // every vendored source
    const px = p.readPixels();
    expect(px.some((v) => v > 0)).toBe(true); // drew something
  });

  it("all filter fragments compile on WebGL1", async () => {
    const filters = await import("../src/index.js");
    const effects = [
      new filters.BlurEffect(),
      new filters.ColorKeyEffect(),
      new filters.PixelateEffect(),
      new filters.VignetteEffect(),
      new filters.ChromaticAberrationEffect(),
      new filters.NoiseGrainEffect(),
      new filters.GlowEffect(),
      new filters.HeatmapEffect(),
      new filters.ShineEffect(),
      new filters.NeonEffect({ flicker: 0.5 }),
      new filters.SparkleEffect(),
      new filters.HolographicEffect(),
      new filters.PulseGlowEffect(),
    ];
    const ctx = { frame: 0, time: 0, fps: 30, width: 4, height: 4, pixelRatio: 1 };
    const rt = new EffectRuntime(p);
    for (const e of effects) {
      const out = rt.applyChain(
        solid(255, 0, 0, 255) as unknown as CanvasImageSource,
        e._kmPasses(ctx),
        4,
        4,
      );
      expect(out, e.constructor.name).not.toBeNull();
    }
  });

  it("returns null (not throw) on a broken fragment", () => {
    const rt = new EffectRuntime(p);
    const out = rt.applyChain(
      solid(0, 0, 0, 255) as unknown as CanvasImageSource,
      [{ fragment: "not glsl", uniforms: {} }],
      4,
      4,
    );
    expect(out).toBeNull();
  });
});
