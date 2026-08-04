import { transpileTo100 } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { BLUR_LENS_FRAG } from "./blur-lens.frag.js";
import { CHROMA_KEY_FRAG } from "./chroma-key.frag.js";
import { DROPLETS_FRAG } from "./droplets.frag.js";
import { FLAME_WRAP_FRAG, FLAME_WRAP_SILHOUETTE_FRAG } from "./flame-wrap.frag.js";

/**
 * `transpileTo100` is four string rewrites, not a GLSL parser. Anything else
 * that is WebGL2-only reaches headless-gl unchanged and fails to compile during
 * a server render, so every fragment must stay inside the GLSL ES 1.00 subset.
 *
 * This is a static guard. The authoritative check is the real headless-gl
 * compile in @smoove/renderer.
 */
const BANNED: Array<[string, RegExp]> = [
  ["floatBitsToUint/Int", /floatBitsTo[UI]nt/],
  ["uint/uvec types", /\b(uint|uvec[234])\b/],
  ["bit shift", /<<|>>/],
  ["bitwise xor", /\^/],
  // Single & or | (not && or ||).
  ["bitwise and", /(?<!&)&(?!&)/],
  ["bitwise or", /(?<!\|)\|(?!\|)/],
  ["modulo operator", /%/],
  ["round()", /\bround\s*\(/],
  ["trunc()", /\btrunc\s*\(/],
  ["switch", /\bswitch\s*\(/],
  ["textureLod/Grad", /\btexture(Lod|Grad)\s*\(/],
  ["inverse()/transpose()", /\b(inverse|transpose)\s*\(/],
  ["integer literal suffix", /\b\d+[uU]\b/],
];

/** Every fragment the package ships, including each preprocessor variant. */
const FRAGMENTS: Array<[string, string]> = [
  ["flame-wrap box", FLAME_WRAP_FRAG],
  ["flame-wrap silhouette", FLAME_WRAP_SILHOUETTE_FRAG],
  ["droplets", DROPLETS_FRAG],
  ["chroma-key", CHROMA_KEY_FRAG],
  ["blur-lens", BLUR_LENS_FRAG],
];

describe.each(FRAGMENTS)("fragment dialect (%s)", (_label, FRAG) => {
  it("declares itself as GLSL ES 3.00", () => {
    expect(FRAG.startsWith("#version 300 es")).toBe(true);
  });

  it("uses only constructs transpileTo100 can downgrade", () => {
    for (const [label, pattern] of BANNED) {
      expect(pattern.test(FRAG), `banned construct: ${label}`).toBe(false);
    }
  });

  it("uses texture() so the rewrite catches it", () => {
    expect(FRAG).toMatch(/\btexture\s*\(/);
    expect(FRAG).not.toMatch(/\btexture2D\s*\(/);
  });

  it("uses only constant-bound loops", () => {
    for (const match of FRAG.matchAll(/for\s*\(([^)]*)\)/g)) {
      expect(match[1], `non-constant loop bound: ${match[0]}`).toMatch(/<\s*\d+\s*;/);
    }
  });

  it("transpiles to GLSL 100 with no leftover 3.00 syntax", () => {
    const out = transpileTo100(FRAG);
    expect(out).not.toMatch(/#version/);
    expect(out).not.toMatch(/\bout\s+vec4\b/);
    expect(out).toMatch(/gl_FragColor/);
    expect(out).toMatch(/\bvarying\s+vec2\s+v_uv/);
    expect(out).toMatch(/\btexture2D\s*\(/);
  });

  it("writes to a single declared fragment output", () => {
    const outputs = FRAG.match(/\bout\s+vec4\s+\w+\s*;/g) ?? [];
    expect(outputs).toHaveLength(1);
  });
});

describe("flame-wrap fragment dialect", () => {
  it("keeps the silhouette variant one define away from the box one", () => {
    expect(FLAME_WRAP_SILHOUETTE_FRAG).toContain("#define SHAPE_SILHOUETTE 1");
    expect(FLAME_WRAP_SILHOUETTE_FRAG.replace("#define SHAPE_SILHOUETTE 1\n", "")).toBe(
      FLAME_WRAP_FRAG,
    );
  });

  it("declares the distance field sampler only where it is read", () => {
    expect(FLAME_WRAP_SILHOUETTE_FRAG).toMatch(/uniform\s+sampler2D\s+u_tex1\s*;/);
  });

  it("declares every uniform the factory sets", () => {
    for (const name of [
      "u_tex0",
      "u_time",
      "u_resolution",
      "u_rectCenter",
      "u_rectHalf",
      "u_radius",
      "u_color",
      "u_intensity",
      "u_height",
      "u_spread",
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
      expect(FLAME_WRAP_FRAG, `missing uniform ${name}`).toMatch(
        new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`),
      );
    }
  });
});

describe("droplets fragment dialect", () => {
  it("declares every uniform the factory sets", () => {
    for (const name of [
      "u_tex0",
      "u_time",
      "u_resolution",
      "u_contentOrigin",
      "u_contentSize",
      "u_sizeRef",
      "u_tint",
      "u_tintStrength",
      "u_intensity",
      "u_speed",
      "u_scale",
      "u_dropWidth",
      "u_dropLength",
      "u_refraction",
      "u_blur",
      "u_vignette",
      "u_fallSpeed",
      "u_wiggle",
      "u_staticDrops",
      "u_sheen",
    ]) {
      expect(DROPLETS_FRAG, `missing uniform ${name}`).toMatch(
        new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`),
      );
    }
  });

  it("reads only the captured content, with no second sampler to feed it", () => {
    expect(DROPLETS_FRAG).not.toMatch(/uniform\s+sampler2D\s+u_tex[1-9]\s*;/);
  });

  it("carries no trail texture, which is how the reference held pointer state", () => {
    expect(DROPLETS_FRAG).not.toMatch(/uTrail|uWipe|uFrom|uTo/);
  });
});

describe("blur-lens fragment dialect", () => {
  it("declares every uniform the factory sets", () => {
    for (const name of [
      "u_tex0",
      "u_resolution",
      "u_contentOrigin",
      "u_radius",
      "u_bloom",
      "u_blades",
      "u_bladeAngle",
    ]) {
      expect(BLUR_LENS_FRAG, `missing uniform ${name}`).toMatch(
        new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`),
      );
    }
  });

  it("reads no clock, because a blur is a function of the pixels alone", () => {
    expect(BLUR_LENS_FRAG).not.toMatch(/u_time/);
  });

  it("reads only the captured content, with no second sampler to feed it", () => {
    expect(BLUR_LENS_FRAG).not.toMatch(/uniform\s+sampler2D\s+u_tex[1-9]\s*;/);
  });

  it("folds the aperture angle without mod(), which the 1.00 subset bans", () => {
    expect(BLUR_LENS_FRAG).not.toMatch(/\bmod\s*\(/);
    expect(BLUR_LENS_FRAG).toMatch(/sector\s*\*\s*floor\(/);
  });
});

describe("chroma-key fragment dialect", () => {
  it("declares every uniform the factory sets", () => {
    for (const name of [
      "u_tex0",
      "u_resolution",
      "u_contentOrigin",
      "u_contentSize",
      "u_key",
      "u_strength",
      "u_similarity",
      "u_smoothness",
      "u_spill",
      "u_choke",
    ]) {
      expect(CHROMA_KEY_FRAG, `missing uniform ${name}`).toMatch(
        new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`),
      );
    }
  });

  it("reads no clock, because a key is a function of the pixels alone", () => {
    expect(CHROMA_KEY_FRAG).not.toMatch(/u_time/);
  });

  it("reads only the captured content, with no second sampler to feed it", () => {
    expect(CHROMA_KEY_FRAG).not.toMatch(/uniform\s+sampler2D\s+u_tex[1-9]\s*;/);
  });
});
