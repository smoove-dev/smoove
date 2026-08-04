import type { GlPlatform } from "@smoove/core";
import {
  CHROMA_KEY_FRAG,
  DROPLETS_FRAG,
  FLAME_WRAP_FRAG,
  FLAME_WRAP_SILHOUETTE_FRAG,
} from "@smoove/effects";
import { beforeAll, describe, expect, it } from "vitest";
import { createNodeGlPlatform } from "./gl-node.js";

/**
 * The authoritative dialect check. `@smoove/effects` guards its fragments with
 * static regexes, but only a real compile proves the server path: headless-gl
 * is WebGL1, so anything GLSL-ES-3.00-only that `transpileTo100` does not
 * rewrite fails here rather than in someone's mp4.
 *
 * Every fragment the package ships is checked, including each preprocessor
 * variant: a `#define` branch is exactly the thing that compiles in one
 * configuration and not the other.
 *
 * One platform for the whole file. headless-gl contexts are a limited resource,
 * and creating one per test exhausts them once other suites want one too, which
 * shows up as uniforms mysteriously failing to resolve.
 */
let platform: GlPlatform;

type Built = { program: WebGLProgram; linked: boolean; linkLog: string };
const built = new Map<string, Built>();

/**
 * Each fragment with the uniforms it must resolve. Unused uniforms are stripped
 * by the compiler, so these are only the ones the fragment actually reads.
 */
const VARIANTS: Array<[string, string, string[]]> = [
  [
    "flame-wrap box",
    FLAME_WRAP_FRAG,
    ["u_tex0", "u_time", "u_resolution", "u_rectCenter", "u_color", "u_intensity"],
  ],
  [
    "flame-wrap silhouette",
    FLAME_WRAP_SILHOUETTE_FRAG,
    ["u_tex0", "u_tex1", "u_time", "u_resolution", "u_rectCenter", "u_color", "u_intensity"],
  ],
  [
    "droplets",
    DROPLETS_FRAG,
    ["u_tex0", "u_time", "u_resolution", "u_contentOrigin", "u_contentSize", "u_intensity"],
  ],
  [
    "chroma-key",
    CHROMA_KEY_FRAG,
    [
      "u_tex0",
      "u_resolution",
      "u_contentOrigin",
      "u_contentSize",
      "u_key",
      "u_strength",
      "u_similarity",
      "u_choke",
    ],
  ],
];

beforeAll(() => {
  const created = createNodeGlPlatform();
  if (!created) {
    throw new Error(
      "headless-gl is unavailable, so the server GL path is unverified. " +
        "This must fail rather than skip: a silent skip is how 'effects missing " +
        "from server mp4s' happened before.",
    );
  }
  platform = created;

  const gl = platform.gl;
  for (const [label, fragment] of VARIANTS) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) throw new Error("could not create shaders");

    gl.shaderSource(vs, platform.vertexShader);
    gl.compileShader(vs);
    gl.shaderSource(fs, platform.prepareFragment(fragment));
    gl.compileShader(fs);

    const program = gl.createProgram();
    if (!program) throw new Error("could not create a program");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    built.set(label, {
      program,
      linked: gl.getProgramParameter(program, gl.LINK_STATUS) === true,
      linkLog: gl.getProgramInfoLog(program) ?? "",
    });
  }
});

describe.each(VARIANTS)("%s on the server GL platform", (label, fragment, uniforms) => {
  it("compiles through headless-gl WebGL1", () => {
    const gl = platform.gl;
    const source = platform.prepareFragment(fragment);
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!shader) throw new Error("could not create a fragment shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const log = gl.getShaderInfoLog(shader) ?? "";
    expect(log, `compile log:\n${log}\n\nsource:\n${source}`).toBe("");
    expect(gl.getShaderParameter(shader, gl.COMPILE_STATUS)).toBe(true);
  });

  it("links against the platform's vertex shader", () => {
    const entry = built.get(label) as Built;
    expect(entry.linked, `link log:\n${entry.linkLog}`).toBe(true);
  });

  it("resolves the uniforms the effect sets", () => {
    const gl = platform.gl;
    const entry = built.get(label) as Built;
    for (const name of uniforms) {
      const location = gl.getUniformLocation(entry.program, name);
      expect(location, `unresolved uniform ${name}`).not.toBeNull();
    }
  });
});
