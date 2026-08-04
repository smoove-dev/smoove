import { describe, expect, it } from "vitest";
import { GlCompositor, type GlPlatform } from "./compositor.js";

/**
 * A {@link GlPlatform} over a stub context that records uniform and texture
 * activity, so the compositor's wiring can be asserted without a real GL
 * surface (Node has no WebGL2, and headless-gl lives in @smoove/renderer).
 */
function fakePlatform() {
  const calls = {
    uploads: [] as number[],
    uniform1i: [] as Array<[string, number]>,
    uniform1f: [] as Array<[string, number]>,
    uniform2f: [] as Array<[string, number, number]>,
    uniform3f: [] as Array<[string, number, number, number]>,
    activeTextures: [] as number[],
    programsCreated: 0,
    draws: 0,
  };
  /** Uniform names the stub program "declares"; anything else resolves null. */
  let declared: Set<string> | null = null;

  const gl = {
    ARRAY_BUFFER: 1,
    STATIC_DRAW: 2,
    TEXTURE_2D: 3,
    TRIANGLE_STRIP: 4,
    COLOR_BUFFER_BIT: 5,
    FLOAT: 6,
    VERTEX_SHADER: 7,
    FRAGMENT_SHADER: 8,
    COMPILE_STATUS: 9,
    LINK_STATUS: 10,
    TEXTURE0: 100,
    TEXTURE_WRAP_S: 11,
    TEXTURE_WRAP_T: 12,
    TEXTURE_MIN_FILTER: 13,
    TEXTURE_MAG_FILTER: 14,
    CLAMP_TO_EDGE: 15,
    LINEAR: 16,
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    deleteShader: () => {},
    createProgram: () => {
      calls.programsCreated += 1;
      return {};
    },
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    deleteProgram: () => {},
    useProgram: () => {},
    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    activeTexture: (unit: number) => calls.activeTextures.push(unit - 100),
    getUniformLocation: (_p: unknown, name: string) =>
      declared === null || declared.has(name) ? name : null,
    uniform1i: (loc: string, v: number) => calls.uniform1i.push([loc, v]),
    uniform1f: (loc: string, v: number) => calls.uniform1f.push([loc, v]),
    uniform2f: (loc: string, a: number, b: number) => calls.uniform2f.push([loc, a, b]),
    uniform3f: (loc: string, a: number, b: number, c: number) =>
      calls.uniform3f.push([loc, a, b, c]),
    uniform4f: () => {},
    drawArrays: () => {
      calls.draws += 1;
    },
  };

  const platform: GlPlatform = {
    gl: gl as unknown as GlPlatform["gl"],
    vertexShader: "vs",
    prepareFragment: (f) => f,
    resize: () => {},
    uploadScene: (_s, w) => calls.uploads.push(w),
    result: () => ({}) as CanvasImageSource,
  };

  return {
    platform,
    calls,
    /** Restrict which uniform names the stub program resolves. */
    declareOnly(names: string[]) {
      declared = new Set(names);
    },
  };
}

const CANVAS = {} as HTMLCanvasElement;

describe("GlCompositor.renderPass", () => {
  it("binds one source to u_tex0 and sets named uniforms", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.renderPass("void main(){}", [CANVAS], { u_intensity: 0.5 }, 64, 32);

    expect(calls.uploads).toEqual([64]);
    expect(calls.uniform1i).toContainEqual(["u_tex0", 0]);
    expect(calls.uniform1f).toContainEqual(["u_intensity", 0.5]);
    expect(calls.draws).toBe(1);
  });

  it("grows the texture pool for multiple sources", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.renderPass("void main(){}", [CANVAS, CANVAS], {}, 8, 8);

    expect(calls.uploads).toHaveLength(2);
    expect(calls.uniform1i).toContainEqual(["u_tex0", 0]);
    expect(calls.uniform1i).toContainEqual(["u_tex1", 1]);
    expect(calls.activeTextures).toEqual([0, 1]);
  });

  it("uploads a third source without reallocating the first two", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.renderPass("void main(){}", [CANVAS], {}, 8, 8);
    c.renderPass("void main(){}", [CANVAS, CANVAS, CANVAS], {}, 8, 8);

    expect(calls.uniform1i).toContainEqual(["u_tex2", 2]);
  });

  it("sets vec2 and vec3 uniforms by arity", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.renderPass(
      "void main(){}",
      [CANVAS],
      { u_resolution: [64, 32], u_color: [1, 0.45, 0.1] },
      64,
      32,
    );

    expect(calls.uniform2f).toContainEqual(["u_resolution", 64, 32]);
    expect(calls.uniform3f).toContainEqual(["u_color", 1, 0.45, 0.1]);
  });

  it("skips uniforms the fragment does not declare", () => {
    const { platform, calls, declareOnly } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);
    declareOnly(["u_tex0"]);

    c.renderPass("void main(){}", [CANVAS], { u_missing: 1 }, 8, 8);

    expect(calls.uniform1f).toHaveLength(0);
    expect(calls.draws).toBe(1);
  });

  it("compiles a given fragment once and caches the program", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.renderPass("void main(){}", [CANVAS], {}, 8, 8);
    c.renderPass("void main(){}", [CANVAS], {}, 8, 8);

    expect(calls.programsCreated).toBe(1);
  });
});

describe("GlCompositor.render", () => {
  it("still binds the transition's u_prev/u_next/u_time", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.render("void main(){}", CANVAS, CANVAS, 0.25, {}, 16, 16);

    expect(calls.uniform1i).toContainEqual(["u_prev", 0]);
    expect(calls.uniform1i).toContainEqual(["u_next", 1]);
    expect(calls.uniform1f).toContainEqual(["u_time", 0.25]);
    expect(calls.draws).toBe(1);
  });

  it("passes extra presentation uniforms through", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.render("void main(){}", CANVAS, CANVAS, 0.5, { u_angle: 1.5 }, 16, 16);

    expect(calls.uniform1f).toContainEqual(["u_angle", 1.5]);
  });

  it("uploads incoming first, then outgoing", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);

    c.render("void main(){}", CANVAS, CANVAS, 0.5, {}, 24, 24);

    expect(calls.uploads).toEqual([24, 24]);
    expect(calls.activeTextures).toEqual([0, 1]);
  });
});
