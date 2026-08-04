# @smoove/effects + flameWrap Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Two repo rules override the default plan format:**
> 1. **NEVER COMMIT.** `AGENTS.md` forbids `git commit`/`git push` unless the maintainer explicitly asks, even when a workflow says to commit. Every task therefore ends in a **Checkpoint** (run the verification, leave the change in the working tree) instead of a commit step.
> 2. **No subagent-driven execution.** Implement inline in the main session.

**Goal:** Ship `@smoove/effects` with one preset, `flameWrap` — animated fire that wraps the alpha silhouette of any smoove node, with heat distortion, sparks, molten rim, smoke and scorch, working identically in browser preview and server renders.

**Architecture:** Core gains `src/effects/` (a `SmooveEffect` contract, a capture/pass/blit pipeline, dirty tracking) and absorbs the WebGL bridge currently living in transitions, so both transitions and effects share one compositor. `flameWrap` is a single-pass fragment shader over two textures: the captured node content, and a signed distance field of its alpha built on the CPU once per content version. Time enters only via `fc.time`, so the effect is frame-pure and seekable.

**Tech Stack:** TypeScript, Konva 10, WebGL2 (browser) / headless-gl WebGL1 (server), skia-canvas, Vitest, pnpm workspaces, Biome, Changesets.

**Spec:** `docs/superpowers/specs/2026-08-03-smoove-effects-flame-wrap-design.md`

---

## File Structure

**Phase 0 — prerequisites**
- Delete: `packages/effects/` (stale untracked `dist/` + tsbuildinfo from the abandoned branch)
- Modify: `packages/renderer/src/gl-node.ts` — bare `module` import + lint guard

**Phase 1 — GL bridge into core**
- Create: `packages/core/src/gl/compositor.ts`, `shared.ts`, `transpile.ts`, `types.ts` (moved)
- Modify: `packages/core/src/index.ts` (barrel), `packages/transitions/src/index.ts` (re-export), `packages/transitions/src/gl/gl-transition.ts` (imports), `packages/transitions/src/types.ts` (drop `GlUniforms`), `packages/renderer/src/gl.ts`, `packages/renderer/src/gl-node.ts`
- Delete: `packages/transitions/src/gl/compositor.ts`, `shared.ts`, `transpile.ts`
- Test: `packages/core/src/gl/compositor.test.ts`

**Phase 2 — core effects pipeline**
- Create: `packages/core/src/effects/contract.ts` — types, `isSmooveEffect`, padding normalization
- Create: `packages/core/src/effects/dirty.ts` — content version, param fingerprint, translation carve-out
- Create: `packages/core/src/effects/apply.ts` — region math, pooled capture, pass coalescing, blit
- Modify: `packages/core/src/engine/sequence.ts` — `applyLayerEffects` hook
- Modify: `packages/core/src/index.ts` — export the contract types
- Test: `contract.test.ts`, `dirty.test.ts`, `apply.test.ts` alongside each

**Phase 3 — the effects package**
- Create: `packages/effects/package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`
- Create: `packages/effects/src/index.ts` — barrel
- Create: `packages/effects/src/params.ts` — param plumbing, fingerprinting, invalidation
- Create: `packages/effects/src/sdf.ts` — chamfer distance transform + cache
- Create: `packages/effects/src/flame-wrap.ts` — the factory
- Create: `packages/effects/src/glsl/flame-wrap.frag.ts` — fragment source
- Test: `sdf.test.ts`, `flame-wrap.test.ts`, `glsl/dialect.test.ts`
- Modify: `.changeset/config.json`, `AGENTS.md`, root `tsconfig.json`

**Phase 4 — verification, docs**
- Test: `packages/renderer/src/effects.test.ts` (integration + WebGL1 compile)
- Create: `packages/kitchen-sink/src/compositions/flame-wrap.ts`
- Modify: `packages/kitchen-sink/src/registry.ts`
- Create: `packages/docs/content/docs/effects.mdx`, `packages/docs/src/demos/flame-wrap.ts`
- Modify: `skills/smoove-video/SKILL.md`, `.changeset/<name>.md`

---

## Task 1: Clear the stale effects directory and fix server GL

`packages/effects/` currently holds a `dist/` and a `tsconfig.tsbuildinfo` left by the abandoned `effects` branch. It is untracked but not gitignored, so `tsc -b` can resolve leftover output once a real package appears at that path.

The `gl-node.ts` fix is a prerequisite from the v2 design: `createRequire` is imported from `node:module`, and demo/template Vite configs alias `node:module` to a browser shim that also applies to the SSR graph — so server GL silently dies in those apps.

**Files:**
- Delete: `packages/effects/dist/`, `packages/effects/tsconfig.tsbuildinfo`
- Modify: `packages/renderer/src/gl-node.ts:7`
- Modify: `biome.json`

- [x] **Step 1: Confirm nothing tracked is being deleted**

Run: `git ls-files packages/effects | wc -l`
Expected: `0`

- [x] **Step 2: Delete the stale directory**

```bash
rm -rf packages/effects
```

- [x] **Step 3: Change the import to bare `module`**

In `packages/renderer/src/gl-node.ts`, line 7:

```ts
// Bare "module", NOT "node:module": app and template Vite configs alias
// "node:module" to a browser shim that also applies to the SSR graph, which
// silently disables headless-gl during server renders. Guarded by a Biome rule.
import { createRequire } from "module";
```

- [x] **Step 4: Add the lint guard**

In `biome.json`, under `linter.rules`, add an override scoped to the renderer that forbids the `node:` prefixed form:

```json
{
  "overrides": [
    {
      "includes": ["packages/renderer/src/gl-node.ts"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "paths": {
                  "node:module": "Use bare \"module\": Vite configs alias node:module to a browser shim in the SSR graph, which silently disables headless-gl."
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

If `biome.json` already has an `overrides` array, add this object to it rather than replacing it.

- [x] **Step 5: Verify the guard fires**

Temporarily change the import back to `node:module`, then run: `pnpm check`
Expected: error naming `node:module` on `gl-node.ts`. Restore the bare `module` import and re-run `pnpm check`.
Expected: clean.

- [x] **Step 6: Checkpoint**

Run: `pnpm --filter @smoove/renderer build && pnpm check`
Expected: both succeed.

---

## Task 2: Move the GL bridge into core

`GlCompositor` is what a `shader` pass needs to run, and it lives in transitions. Leaving it there forces `@smoove/core` → `@smoove/transitions`, which is circular. Move the bridge to core; transitions re-exports so no consumer breaks.

**Files:**
- Create: `packages/core/src/gl/compositor.ts`, `packages/core/src/gl/shared.ts`, `packages/core/src/gl/transpile.ts`, `packages/core/src/gl/types.ts`
- Delete: `packages/transitions/src/gl/compositor.ts`, `packages/transitions/src/gl/shared.ts`, `packages/transitions/src/gl/transpile.ts`
- Modify: `packages/core/src/index.ts`, `packages/transitions/src/index.ts`, `packages/transitions/src/types.ts`, `packages/transitions/src/gl/gl-transition.ts`, `packages/transitions/src/transition-series.ts`, `packages/renderer/src/gl.ts`, `packages/renderer/src/gl-node.ts`

- [x] **Step 1: Move the three files with git mv**

```bash
mkdir -p packages/core/src/gl
git mv packages/transitions/src/gl/compositor.ts packages/core/src/gl/compositor.ts
git mv packages/transitions/src/gl/shared.ts packages/core/src/gl/shared.ts
git mv packages/transitions/src/gl/transpile.ts packages/core/src/gl/transpile.ts
```

- [x] **Step 2: Create `packages/core/src/gl/types.ts`**

`GlUniforms` currently lives in `packages/transitions/src/types.ts:11` and is needed by the compositor.

```ts
/** Uniform values a fragment pass can set: float, vec2, vec3 or vec4. */
export type GlUniforms = Record<string, number | number[]>;
```

- [x] **Step 3: Repoint the compositor's own import**

In `packages/core/src/gl/compositor.ts`, line 1:

```ts
import { createProgram, createTexture, type GlContext, VERTEX_SHADER } from "./shared.js";
import type { GlUniforms } from "./types.js";
```

Also update the three `throw new Error("transitions: ...")` messages in `shared.ts` to say `smoove:` instead, since the file no longer belongs to transitions.

- [x] **Step 4: Export from the core barrel**

Add to `packages/core/src/index.ts`:

```ts
export {
  GlCompositor,
  type GlPlatform,
  getCompositor,
  setCompositorFactory,
} from "./gl/compositor.js";
export { type GlContext, VERTEX_SHADER, VERTEX_SHADER_100 } from "./gl/shared.js";
export { transpileTo100 } from "./gl/transpile.js";
export type { GlUniforms } from "./gl/types.js";
```

- [x] **Step 5: Re-export from transitions for back-compat**

Replace the corresponding lines at the top of `packages/transitions/src/index.ts`:

```ts
export {
  GlCompositor,
  type GlContext,
  type GlPlatform,
  type GlUniforms,
  getCompositor,
  setCompositorFactory,
  transpileTo100,
  VERTEX_SHADER,
  VERTEX_SHADER_100,
} from "@smoove/core";
export { glTransition } from "./gl/gl-transition.js";
```

In `packages/transitions/src/types.ts`, delete the `GlUniforms` type declaration (line 11) and import it instead:

```ts
import type { GlUniforms } from "@smoove/core";
```

- [x] **Step 6: Repoint the remaining transitions imports**

In `packages/transitions/src/gl/gl-transition.ts`, change:

```ts
import { createProgram, createTexture, type GlContext, VERTEX_SHADER } from "@smoove/core";
import type { GlUniforms } from "@smoove/core";
```

`createProgram` and `createTexture` are not currently in the core barrel — add them to the Step 4 export from `./gl/shared.js`.

In `packages/transitions/src/transition-series.ts:15`, change `import { getCompositor } from "./gl/compositor.js";` to `import { getCompositor } from "@smoove/core";`.

In `packages/transitions/src/transition-series.test.ts:4`, change the import of `GlCompositor` and `setCompositorFactory` to `@smoove/core`.

- [x] **Step 7: Repoint the renderer**

`packages/renderer/src/gl.ts:1`:

```ts
import { GlCompositor, setCompositorFactory } from "@smoove/core";
```

`packages/renderer/src/gl-node.ts:1`:

```ts
import { type GlPlatform, transpileTo100, VERTEX_SHADER_100 } from "@smoove/core";
```

- [x] **Step 8: Verify nothing references the old paths**

Run: `grep -rn --include="*.ts" "gl/compositor\|gl/shared\|gl/transpile" packages/*/src`
Expected: only `packages/core/src/gl/*` internal relative imports.

- [x] **Step 9: Checkpoint — the existing transitions tests are the regression net**

Run: `pnpm build && pnpm --filter @smoove/transitions test && pnpm --filter @smoove/core test && pnpm check`
Expected: all pass. `transition-series.test.ts` exercises the compositor factory, so a broken move shows up here.

---

## Task 3: Generalize the compositor with `renderPass`

`render()` has the transition baked in: two canvases bound to `u_prev`/`u_next`, `u_time` as progress, exactly two preallocated textures. Effects need one texture plus arbitrary uniform names.

**Files:**
- Modify: `packages/core/src/gl/compositor.ts`
- Test: `packages/core/src/gl/compositor.test.ts` (create)

- [x] **Step 1: Write the failing test**

Create `packages/core/src/gl/compositor.test.ts`. It uses a fake `GlPlatform` that records calls, so no real GL context is needed.

```ts
import { describe, expect, it, vi } from "vitest";
import { GlCompositor, type GlPlatform } from "./compositor.js";

/** A GlPlatform over a stub context that records uniform + texture activity. */
function fakePlatform() {
  const calls = {
    uploads: [] as number[],
    uniform1i: [] as Array<[string, number]>,
    uniform1f: [] as Array<[string, number]>,
    boundTextures: [] as number[],
    draws: 0,
  };
  const locations = new Map<string, string>();
  const gl = {
    ARRAY_BUFFER: 1, STATIC_DRAW: 2, TEXTURE_2D: 3, TRIANGLE_STRIP: 4,
    COLOR_BUFFER_BIT: 5, FLOAT: 6, VERTEX_SHADER: 7, FRAGMENT_SHADER: 8,
    COMPILE_STATUS: 9, LINK_STATUS: 10, TEXTURE0: 100,
    TEXTURE_WRAP_S: 11, TEXTURE_WRAP_T: 12, TEXTURE_MIN_FILTER: 13,
    TEXTURE_MAG_FILTER: 14, CLAMP_TO_EDGE: 15, LINEAR: 16,
    createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {},
    createTexture: () => ({}), bindTexture: (_t: number, tex: unknown) => {
      calls.boundTextures.push((tex as { id: number }).id ?? -1);
    },
    texParameteri: () => {}, texImage2D: () => {},
    createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
    getShaderParameter: () => true, deleteShader: () => {},
    createProgram: () => ({}), attachShader: () => {}, linkProgram: () => {},
    getProgramParameter: () => true, deleteProgram: () => {},
    useProgram: () => {}, viewport: () => {}, clearColor: () => {}, clear: () => {},
    getAttribLocation: () => 0, enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {}, activeTexture: () => {},
    getUniformLocation: (_p: unknown, name: string) => {
      locations.set(name, name);
      return name;
    },
    uniform1i: (loc: string, v: number) => calls.uniform1i.push([loc, v]),
    uniform1f: (loc: string, v: number) => calls.uniform1f.push([loc, v]),
    uniform2f: () => {}, uniform3f: () => {}, uniform4f: () => {},
    drawArrays: () => { calls.draws += 1; },
  };
  const platform: GlPlatform = {
    gl: gl as unknown as GlPlatform["gl"],
    vertexShader: "vs",
    prepareFragment: (f) => f,
    resize: () => {},
    uploadScene: (_s, w) => calls.uploads.push(w),
    result: () => ({}) as CanvasImageSource,
  };
  return { platform, calls };
}

describe("GlCompositor.renderPass", () => {
  it("binds one source to u_tex0 and sets named uniforms", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);
    const src = {} as HTMLCanvasElement;

    c.renderPass("void main(){}", [src], { u_intensity: 0.5 }, 64, 32);

    expect(calls.uploads).toEqual([64]);
    expect(calls.uniform1i).toContainEqual(["u_tex0", 0]);
    expect(calls.uniform1f).toContainEqual(["u_intensity", 0.5]);
    expect(calls.draws).toBe(1);
  });

  it("grows the texture pool for multiple sources", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);
    const a = {} as HTMLCanvasElement;
    const b = {} as HTMLCanvasElement;

    c.renderPass("void main(){}", [a, b], {}, 8, 8);

    expect(calls.uploads).toHaveLength(2);
    expect(calls.uniform1i).toContainEqual(["u_tex0", 0]);
    expect(calls.uniform1i).toContainEqual(["u_tex1", 1]);
  });

  it("still serves transitions through render()", () => {
    const { platform, calls } = fakePlatform();
    const c = GlCompositor.fromPlatform(platform);
    const a = {} as HTMLCanvasElement;
    const b = {} as HTMLCanvasElement;

    c.render("void main(){}", a, b, 0.25, {}, 16, 16);

    expect(calls.uniform1i).toContainEqual(["u_prev", 0]);
    expect(calls.uniform1i).toContainEqual(["u_next", 1]);
    expect(calls.uniform1f).toContainEqual(["u_time", 0.25]);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @smoove/core test -- compositor`
Expected: FAIL — `c.renderPass is not a function`.

- [x] **Step 3: Implement `renderPass`**

In `packages/core/src/gl/compositor.ts`, replace the fixed `prevTex`/`nextTex` fields with an on-demand pool, and restructure `ProgramEntry` so uniform locations are looked up by name generically:

```ts
type ProgramEntry = {
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};
```

Add to the class:

```ts
  private readonly texPool: WebGLTexture[] = [];

  /** Texture for slot `i`, created on first use. */
  private texture(i: number): WebGLTexture {
    let tex = this.texPool[i];
    if (!tex) {
      tex = createTexture(this.gl);
      this.texPool[i] = tex;
    }
    return tex;
  }

  /** Cached uniform location lookup for `entry`. */
  private location(entry: ProgramEntry, name: string): WebGLUniformLocation | null {
    if (!entry.locations.has(name)) {
      entry.locations.set(name, this.gl.getUniformLocation(entry.program, name));
    }
    return entry.locations.get(name) ?? null;
  }

  private setUniform(entry: ProgramEntry, name: string, value: number | number[]): void {
    const gl = this.gl;
    const loc = this.location(entry, name);
    if (loc === null) return;
    if (typeof value === "number") {
      gl.uniform1f(loc, value);
    } else if (value.length === 2) {
      gl.uniform2f(loc, value[0] as number, value[1] as number);
    } else if (value.length === 3) {
      gl.uniform3f(loc, value[0] as number, value[1] as number, value[2] as number);
    } else if (value.length === 4) {
      gl.uniform4f(
        loc, value[0] as number, value[1] as number,
        value[2] as number, value[3] as number,
      );
    }
  }

  /**
   * Run `fragment` over `sources`, bound to `u_tex0`..`u_texN`, with `uniforms`
   * set by name. Pure in `(fragment, sources, uniforms)` → reproducible.
   * Returns an image to draw immediately (the platform reuses its buffer).
   */
  renderPass(
    fragment: string,
    sources: readonly CanvasImage[],
    uniforms: GlUniforms,
    width: number,
    height: number,
  ): CanvasImageSource {
    const gl = this.gl;
    this.platform.resize(width, height);
    const entry = this.getEntry(fragment);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(entry.program);

    const aPos = gl.getAttribLocation(entry.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (let i = 0; i < sources.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.texture(i));
      this.platform.uploadScene(sources[i] as CanvasImage, width, height);
      const loc = this.location(entry, `u_tex${i}`);
      if (loc !== null) gl.uniform1i(loc, i);
    }

    for (const [name, value] of Object.entries(uniforms)) {
      this.setUniform(entry, name, value);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.platform.result(width, height);
  }
```

`getEntry(fragment)` loses its `extraNames` parameter — locations are now looked up lazily by name.

- [x] **Step 4: Rewrite `render()` as a wrapper**

```ts
  /**
   * Render a transition frame. `u_prev` is the **incoming** scene and `u_next`
   * the **outgoing** one (Remotion's inverted binding); `u_time` is progress.
   * Thin wrapper over {@link renderPass} that keeps the transition uniform names.
   */
  render(
    fragment: string,
    incoming: CanvasImage,
    outgoing: CanvasImage,
    progress: number,
    uniforms: GlUniforms,
    width: number,
    height: number,
  ): CanvasImageSource {
    return this.renderPass(
      fragment,
      [incoming, outgoing],
      { ...uniforms, u_time: progress },
      width,
      height,
    );
  }
```

This binds slot 0 to `u_tex0` *and* needs `u_prev`/`u_next`. Handle it by having `renderPass` also bind the aliases when present: after the `u_tex${i}` lookup, for `i === 0` try `u_prev`, for `i === 1` try `u_next`, setting whichever location resolves. Existing transition fragments declare only `u_prev`/`u_next`, so `u_tex0` resolves to `null` and is skipped; effects fragments do the reverse.

- [x] **Step 5: Run the tests**

Run: `pnpm --filter @smoove/core test -- compositor`
Expected: all three PASS.

- [x] **Step 6: Checkpoint**

Run: `pnpm build && pnpm --filter @smoove/transitions test && pnpm check`
Expected: pass. Transitions behaviour is unchanged.

---

## Task 4: The effect contract

**Files:**
- Create: `packages/core/src/effects/contract.ts`
- Test: `packages/core/src/effects/contract.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isSmooveEffect, normalizePadding, maxPadding } from "./contract.js";

describe("normalizePadding", () => {
  it("expands a scalar to four sides", () => {
    expect(normalizePadding(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it("passes a per-side object through", () => {
    const p = { top: 170, right: 8, bottom: 8, left: 8 };
    expect(normalizePadding(p)).toEqual(p);
  });

  it("treats undefined as zero", () => {
    expect(normalizePadding(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe("maxPadding", () => {
  it("takes the per-side maximum across a chain", () => {
    expect(maxPadding([
      { top: 170, right: 8, bottom: 8, left: 8 },
      { top: 4, right: 40, bottom: 0, left: 0 },
    ])).toEqual({ top: 170, right: 40, bottom: 8, left: 8 });
  });

  it("is zero for an empty chain", () => {
    expect(maxPadding([])).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe("isSmooveEffect", () => {
  it("accepts an object carrying the brand", () => {
    expect(isSmooveEffect({ _fxEffect: true })).toBe(true);
  });

  it("rejects plain objects, null and primitives", () => {
    expect(isSmooveEffect({})).toBe(false);
    expect(isSmooveEffect(null)).toBe(false);
    expect(isSmooveEffect(7)).toBe(false);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @smoove/core test -- contract`
Expected: FAIL — cannot resolve `./contract.js`.

- [x] **Step 3: Implement the contract**

```ts
import type Konva from "konva";
import type { GlUniforms } from "../gl/types.js";

/** Frame state handed to an effect each time it is asked for its passes. */
export interface EffectFrameContext {
  frame: number;
  /** `frame / fps`, in seconds. Always the frame clock, never wall clock. */
  time: number;
  fps: number;
  /** Captured region size, device px. */
  width: number;
  height: number;
  pixelRatio: number;
}

/** How far an effect bleeds past the node's bounding box, in CSS px. */
export type EffectPadding =
  | number
  | { top: number; right: number; bottom: number; left: number };

export type EffectPaddingBox = { top: number; right: number; bottom: number; left: number };

/** One unit of Canvas2D or GL work in an effect chain. */
export type EffectPass =
  | { kind: "css"; filter: string }
  | { kind: "pixels"; run(data: Uint8ClampedArray, w: number, h: number): void }
  | { kind: "composite"; run(ctx: CanvasRenderingContext2D, fc: EffectFrameContext): void }
  | {
      kind: "shader";
      fragment: string;
      uniforms: GlUniforms;
      /** Extra textures bound after the working canvas, e.g. an SDF. */
      textures?(fc: EffectFrameContext): (HTMLCanvasElement | OffscreenCanvas)[];
    };

export interface SmooveEffect {
  readonly _fxEffect: true;
  /** `false` skips the effect entirely for this frame. */
  enabled(): boolean;
  passes(fc: EffectFrameContext): EffectPass[];
  padding?(fc: EffectFrameContext): EffectPadding;
  /** Called when the effect joins a node's chain, so param sets can invalidate. */
  attach(node: Konva.Node): void;
  detach(node: Konva.Node): void;
}

export function isSmooveEffect(value: unknown): value is SmooveEffect {
  return typeof value === "object" && value !== null && "_fxEffect" in value;
}

export function normalizePadding(p: EffectPadding | undefined): EffectPaddingBox {
  if (p === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return p;
}

export function maxPadding(boxes: readonly EffectPaddingBox[]): EffectPaddingBox {
  const out = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const b of boxes) {
    if (b.top > out.top) out.top = b.top;
    if (b.right > out.right) out.right = b.right;
    if (b.bottom > out.bottom) out.bottom = b.bottom;
    if (b.left > out.left) out.left = b.left;
  }
  return out;
}
```

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @smoove/core test -- contract`
Expected: PASS.

- [x] **Step 5: Export from the barrel**

Add to `packages/core/src/index.ts`:

```ts
export {
  type EffectFrameContext,
  type EffectPadding,
  type EffectPaddingBox,
  type EffectPass,
  isSmooveEffect,
  maxPadding,
  normalizePadding,
  type SmooveEffect,
} from "./effects/contract.js";
```

- [x] **Step 6: Checkpoint**

Run: `pnpm --filter @smoove/core build && pnpm --filter @smoove/core test && pnpm check`
Expected: pass.

---

## Task 5: Dirty tracking

An effect chain must skip all work when neither the node's content nor the effect's params changed, and must survive a pure translation without rebuilding (a static burning title sliding across frame keeps its cached SDF).

**Files:**
- Create: `packages/core/src/effects/dirty.ts`
- Test: `packages/core/src/effects/dirty.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import Konva from "konva";
import { beforeEach, describe, expect, it } from "vitest";
import { contentVersion, bumpContentVersion, isTranslationOnly, fingerprint } from "./dirty.js";

describe("contentVersion", () => {
  let group: Konva.Group;
  beforeEach(() => {
    group = new Konva.Group();
  });

  it("starts at zero and increments on bump", () => {
    expect(contentVersion(group)).toBe(0);
    bumpContentVersion(group);
    expect(contentVersion(group)).toBe(1);
  });

  it("bumps when a child is added", () => {
    const before = contentVersion(group);
    group.add(new Konva.Rect({ width: 10, height: 10 }));
    expect(contentVersion(group)).toBeGreaterThan(before);
  });
});

describe("isTranslationOnly", () => {
  it("accepts x and y", () => {
    expect(isTranslationOnly("x")).toBe(true);
    expect(isTranslationOnly("y")).toBe(true);
  });

  it("rejects rotation, scale and fill", () => {
    expect(isTranslationOnly("rotation")).toBe(false);
    expect(isTranslationOnly("scaleX")).toBe(false);
    expect(isTranslationOnly("fill")).toBe(false);
  });
});

describe("fingerprint", () => {
  it("is stable for equal param objects", () => {
    expect(fingerprint({ a: 1, b: [1, 2] })).toBe(fingerprint({ a: 1, b: [1, 2] }));
  });

  it("is order-independent over keys", () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });

  it("changes when a value changes", () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 1.5 }));
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @smoove/core test -- dirty`
Expected: FAIL — cannot resolve `./dirty.js`.

- [x] **Step 3: Implement dirty tracking**

```ts
import type Konva from "konva";
import type { GlUniforms } from "../gl/types.js";

const VERSION = Symbol("smoove.fx.contentVersion");
const PATCHED = Symbol("smoove.fx.patched");

type Tracked = Konva.Node & {
  [VERSION]?: number;
  [PATCHED]?: boolean;
  _fireChangeEvent?: (...args: unknown[]) => void;
};

/**
 * Monotonic content version for `node`. Bumped by any attribute change,
 * add or remove in its subtree — the signal an effect chain uses to decide
 * whether its cached capture and derived data (e.g. an SDF) are still valid.
 *
 * Patching is lazy: the hooks are installed the first time a node is asked
 * for its version, so nodes with no effects pay nothing.
 */
export function contentVersion(node: Konva.Node): number {
  const n = node as Tracked;
  if (!n[PATCHED]) patch(n);
  return n[VERSION] ?? 0;
}

export function bumpContentVersion(node: Konva.Node): void {
  const n = node as Tracked;
  n[VERSION] = (n[VERSION] ?? 0) + 1;
}

function patch(n: Tracked): void {
  n[PATCHED] = true;
  n[VERSION] = 0;

  const fire = n._fireChangeEvent?.bind(n);
  if (fire) {
    n._fireChangeEvent = (...args: unknown[]) => {
      const attr = args[0];
      if (typeof attr !== "string" || !isTranslationOnly(attr)) bumpContentVersion(n);
      fire(...args);
    };
  }

  const container = n as unknown as {
    add?: (...children: Konva.Node[]) => unknown;
    _remove?: (child: Konva.Node) => unknown;
  };
  const add = container.add?.bind(container);
  if (add) {
    container.add = (...children: Konva.Node[]) => {
      bumpContentVersion(n);
      return add(...children);
    };
  }
  const remove = container._remove?.bind(container);
  if (remove) {
    container._remove = (child: Konva.Node) => {
      bumpContentVersion(n);
      return remove(child);
    };
  }
}

/**
 * Attributes that move a node without changing its pixels. A write to one of
 * these does not invalidate a cached capture: the pipeline re-blits the cached
 * output at the new position instead. Rotation and scale are deliberately
 * excluded — they change the rasterization.
 */
export function isTranslationOnly(attr: string): boolean {
  return attr === "x" || attr === "y";
}

/** Order-independent, stable string key for a param set. */
export function fingerprint(params: Readonly<Record<string, unknown>> | GlUniforms): string {
  const keys = Object.keys(params).sort();
  let out = "";
  for (const k of keys) {
    const v = (params as Record<string, unknown>)[k];
    out += `${k}=${Array.isArray(v) ? v.join(",") : String(v)};`;
  }
  return out;
}
```

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @smoove/core test -- dirty`
Expected: PASS.

- [x] **Step 5: Checkpoint**

Run: `pnpm --filter @smoove/core build && pnpm --filter @smoove/core test && pnpm check`
Expected: pass.

---

## Task 6: Region math and pass coalescing

The pipeline's pure, testable half: turning a node bbox plus a chain's padding into a device-pixel capture region, and grouping a pass list so consecutive same-kind passes share one round trip.

**Files:**
- Create: `packages/core/src/effects/apply.ts`
- Test: `packages/core/src/effects/apply.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { EffectPass } from "./contract.js";
import { captureRegion, coalesce } from "./apply.js";

describe("captureRegion", () => {
  it("pads per side, scales by pixelRatio and rounds up to 32px buckets", () => {
    const r = captureRegion(
      { x: 100, y: 50, width: 200, height: 40 },
      { top: 170, right: 8, bottom: 8, left: 8 },
      1,
    );
    // left edge 100-8=92, top 50-170=-120; size 216x218 rounds to 224x224
    expect(r).toEqual({ x: 92, y: -120, width: 224, height: 224 });
  });

  it("scales padding and geometry by pixelRatio", () => {
    const r = captureRegion(
      { x: 0, y: 0, width: 100, height: 100 },
      { top: 10, right: 10, bottom: 10, left: 10 },
      2,
    );
    // 2x: bbox 200x200, pad 20 each side -> 240x240, already bucket-aligned
    expect(r).toEqual({ x: -20, y: -20, width: 240, height: 240 });
  });

  it("is stable across sub-bucket size changes", () => {
    const pad = { top: 0, right: 0, bottom: 0, left: 0 };
    const a = captureRegion({ x: 0, y: 0, width: 100, height: 100 }, pad, 1);
    const b = captureRegion({ x: 0, y: 0, width: 110, height: 110 }, pad, 1);
    expect(a.width).toBe(b.width);
  });
});

describe("coalesce", () => {
  const css = (filter: string): EffectPass => ({ kind: "css", filter });
  const pixels = (): EffectPass => ({ kind: "pixels", run: () => {} });
  const composite = (): EffectPass => ({ kind: "composite", run: () => {} });

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
    const groups = coalesce([pixels(), css("blur(1px)"), composite()]);
    expect(groups.map((g) => g.kind)).toEqual(["pixels", "css", "composite"]);
  });

  it("does not merge css passes separated by another kind", () => {
    const groups = coalesce([css("blur(1px)"), composite(), css("blur(2px)")]);
    expect(groups.map((g) => g.kind)).toEqual(["css", "composite", "css"]);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @smoove/core test -- apply`
Expected: FAIL — cannot resolve `./apply.js`.

- [x] **Step 3: Implement the pure helpers**

```ts
import type { EffectPaddingBox, EffectPass } from "./contract.js";

/** Texture sizes snap to this many device px so they stay stable under animation. */
const BUCKET = 32;

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * The device-pixel region to capture for a chain: the node's CSS-px bounding
 * box grown by per-side padding, scaled by `pixelRatio`, with the size rounded
 * up to {@link BUCKET} buckets. Bucketing matters because an animated size
 * would otherwise reallocate the pooled canvas and its GPU texture every frame.
 */
export function captureRegion(
  bbox: Rect,
  pad: EffectPaddingBox,
  pixelRatio: number,
): Rect {
  const x = (bbox.x - pad.left) * pixelRatio;
  const y = (bbox.y - pad.top) * pixelRatio;
  const w = (bbox.width + pad.left + pad.right) * pixelRatio;
  const h = (bbox.height + pad.top + pad.bottom) * pixelRatio;
  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.ceil(w / BUCKET) * BUCKET,
    height: Math.ceil(h / BUCKET) * BUCKET,
  };
}

export type PassGroup =
  | { kind: "css"; filter: string }
  | { kind: "pixels"; passes: Extract<EffectPass, { kind: "pixels" }>[] }
  | { kind: "composite"; passes: Extract<EffectPass, { kind: "composite" }>[] }
  | { kind: "shader"; passes: Extract<EffectPass, { kind: "shader" }>[] };

/**
 * Group a flat pass list so consecutive same-kind passes share one round trip:
 * `css` passes join into a single `ctx.filter` string and one `drawImage`;
 * `pixels` passes share one `getImageData`/`putImageData` pair. Author order
 * across kinds is always preserved, because effect order is semantic (keying
 * before blurring is not the same as blurring before keying).
 */
export function coalesce(passes: readonly EffectPass[]): PassGroup[] {
  const groups: PassGroup[] = [];
  for (const pass of passes) {
    const last = groups[groups.length - 1];
    if (pass.kind === "css") {
      if (last?.kind === "css") last.filter = `${last.filter} ${pass.filter}`;
      else groups.push({ kind: "css", filter: pass.filter });
    } else if (last?.kind === pass.kind) {
      (last.passes as EffectPass[]).push(pass);
    } else {
      groups.push({ kind: pass.kind, passes: [pass] } as PassGroup);
    }
  }
  return groups;
}
```

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @smoove/core test -- apply`
Expected: PASS.

- [x] **Step 5: Checkpoint**

Run: `pnpm --filter @smoove/core test && pnpm check`
Expected: pass.

---

## Task 7: Wire the pipeline into node drawing

The stateful half: intercept a node's `drawScene`, capture into a pooled canvas, run the coalesced groups, blit the result.

**This task carries the plan's main unknown.** Konva's `drawScene(canvas, top, bufferCanvas)` is not a documented extension point, and the exact re-entry and transform handling has to be confirmed against the installed Konva. Step 1 is a spike, not a guess.

**Files:**
- Modify: `packages/core/src/effects/apply.ts`
- Modify: `packages/core/src/engine/sequence.ts`
- Test: `packages/core/src/effects/apply-draw.test.ts`

- [x] **Step 1: Spike — confirm the interception point**

Write a throwaway script at `/private/tmp/claude-501/-Users-rotem-development-konva-motion/6d57b651-6439-4a91-a786-e535892aded2/scratchpad/spike-drawscene.mjs` that imports `konva/skia-backend`, builds a `Konva.Stage` + `Layer` + `Rect`, replaces the rect's own `drawScene` with a wrapper that logs its arguments and calls through, then calls `layer.draw()`.

Record and confirm before writing any pipeline code:
- the argument list `drawScene` actually receives;
- whether the wrapper is called once per `layer.draw()`;
- what `canvas.getContext()` returns and whether the context is already transformed into the node's local space or into layer space;
- whether `node.getClientRect({ relativeTo: layer })` gives the layer-space bbox the region math needs.

Write the answers into a comment block at the top of `apply.ts`. If the context arrives already transformed, the blit must happen under a `ctx.save()`/`setTransform(identity)`/`ctx.restore()` — note which.

- [x] **Step 2: Write the failing test**

```ts
import Konva from "konva";
import { describe, expect, it } from "vitest";
import type { EffectPass, SmooveEffect } from "./contract.js";
import { initNodeEffects } from "./apply.js";

/** Minimal effect that paints the whole captured region a flat colour. */
function fill(color: string, padding = 0): SmooveEffect {
  return {
    _fxEffect: true,
    enabled: () => true,
    padding: () => padding,
    passes: (): EffectPass[] => [
      {
        kind: "composite",
        run: (ctx, fc) => {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, fc.width, fc.height);
        },
      },
    ],
    attach: () => {},
    detach: () => {},
  };
}

function stageWithRect() {
  const stage = new Konva.Stage({ width: 100, height: 100 });
  const layer = new Konva.Layer();
  const rect = new Konva.Rect({ x: 20, y: 20, width: 40, height: 40, fill: "black" });
  stage.add(layer);
  layer.add(rect);
  return { stage, layer, rect };
}

function pixelAt(layer: Konva.Layer, x: number, y: number): [number, number, number, number] {
  const ctx = layer.getCanvas().getContext()._context as CanvasRenderingContext2D;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0] as number, d[1] as number, d[2] as number, d[3] as number];
}

describe("initNodeEffects", () => {
  it("routes drawing through the chain", () => {
    const { layer, rect } = stageWithRect();
    rect.setAttr("effects", [fill("rgb(255,0,0)")]);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual([255, 0, 0, 255]);
  });

  it("draws normally when the chain is empty", () => {
    const { layer, rect } = stageWithRect();
    rect.setAttr("effects", []);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual([0, 0, 0, 255]);
  });

  it("draws normally when every effect is disabled", () => {
    const { layer, rect } = stageWithRect();
    const off: SmooveEffect = { ...fill("rgb(255,0,0)"), enabled: () => false };
    rect.setAttr("effects", [off]);
    initNodeEffects(rect);
    layer.draw();
    expect(pixelAt(layer, 40, 40)).toEqual([0, 0, 0, 255]);
  });

  it("paints outside the node's bbox when the effect pads", () => {
    const { layer, rect } = stageWithRect();
    rect.setAttr("effects", [fill("rgb(0,255,0)", 16)]);
    initNodeEffects(rect);
    layer.draw();
    // 8px above the rect's top edge is inside the padded region, outside the bbox
    expect(pixelAt(layer, 40, 12)).toEqual([0, 255, 0, 255]);
  });

  it("does not recurse when the effect chain triggers a redraw", () => {
    const { layer, rect } = stageWithRect();
    let draws = 0;
    const counting: SmooveEffect = {
      ...fill("rgb(0,0,255)"),
      passes: () => {
        draws += 1;
        return fill("rgb(0,0,255)").passes({} as never);
      },
    };
    rect.setAttr("effects", [counting]);
    initNodeEffects(rect);
    layer.draw();
    expect(draws).toBe(1);
  });
});
```

- [x] **Step 3: Run it to make sure it fails**

Run: `pnpm --filter @smoove/core test -- apply-draw`
Expected: FAIL — `initNodeEffects` is not exported.

- [x] **Step 4: Implement the interception**

Add to `packages/core/src/effects/apply.ts`, using the facts recorded in Step 1:

```ts
import type Konva from "konva";
import { getCompositor } from "../gl/compositor.js";
import {
  type EffectFrameContext,
  isSmooveEffect,
  maxPadding,
  normalizePadding,
  type SmooveEffect,
} from "./contract.js";
import { contentVersion } from "./dirty.js";

const ORIGINAL = Symbol("smoove.fx.drawScene");
const DRAWING = Symbol("smoove.fx.drawing");

type Hooked = Konva.Node & {
  [ORIGINAL]?: (...args: unknown[]) => unknown;
  [DRAWING]?: boolean;
};

/** Pooled work canvases, keyed by `${width}x${height}`. */
const pool = new Map<string, HTMLCanvasElement>();

function workCanvas(width: number, height: number): HTMLCanvasElement {
  const key = `${width}x${height}`;
  let c = pool.get(key);
  if (!c) {
    c = Konva.Util.createCanvasElement();
    c.width = width;
    c.height = height;
    pool.set(key, c);
  }
  return c;
}

function chainOf(node: Konva.Node): SmooveEffect[] {
  const raw = node.getAttr("effects") as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSmooveEffect).filter((e) => e.enabled());
}

/**
 * Route `node`'s scene drawing through its effect chain. Idempotent: calling
 * twice leaves one wrapper installed. A node whose `effects` attr is empty or
 * fully disabled draws through the original path with no capture at all.
 */
export function initNodeEffects(node: Konva.Node): void {
  const n = node as Hooked;
  if (n[ORIGINAL]) return;

  const original = (n as unknown as Record<string, (...a: unknown[]) => unknown>).drawScene;
  n[ORIGINAL] = original.bind(n);

  (n as unknown as Record<string, unknown>).drawScene = function (...args: unknown[]) {
    // Re-entry guard: capturing the node calls the original drawScene, which
    // must not re-enter the chain.
    if (n[DRAWING]) return n[ORIGINAL]?.(...args);
    const chain = chainOf(n);
    if (chain.length === 0) return n[ORIGINAL]?.(...args);
    n[DRAWING] = true;
    try {
      return drawNodeWithEffects(n, chain, args);
    } finally {
      n[DRAWING] = false;
    }
  };
}

export function disposeNodeEffects(node: Konva.Node): void {
  const n = node as Hooked;
  if (!n[ORIGINAL]) return;
  (n as unknown as Record<string, unknown>).drawScene = n[ORIGINAL];
  delete n[ORIGINAL];
}
```

Then `drawNodeWithEffects`, which composes what Tasks 4–6 already built:

1. Build `fc` from the node's Sequence (`frame`, `fps`, `time = frame / fps`) and the layer's `pixelRatio`. Reach the frame via `node.getSequence()`; when there is no sequence (a bare stage in a test), use `frame: 0, fps: 30`.
2. `const pad = maxPadding(chain.map((e) => normalizePadding(e.padding?.(fc))))`.
3. `const region = captureRegion(node.getClientRect({ relativeTo: layer }), pad, pixelRatio)`.
4. Fill in `fc.width`/`fc.height` from `region`, then get `workCanvas(region.width, region.height)` and `ctx.reset()` it — **required**, not optional: pooled canvases are long-lived, and skia accumulates its display list until reset (see `doc/effects-performance-research.md`, S0).
5. Capture: translate the work context by `(-region.x, -region.y)` and call `n[ORIGINAL]` into it.
6. Run `coalesce(chain.flatMap((e) => e.passes(fc)))`:
   - `css`: `ctx.filter = group.filter`, `drawImage(work, 0, 0)` into a second pooled canvas, swap.
   - `pixels`: one `getImageData`, each `run(data, w, h)` in order, one `putImageData`.
   - `composite`: `run(ctx, fc)` directly on the work context.
   - `shader`: `const c = getCompositor()`. If null, warn once per chain and skip the group. Otherwise `c.renderPass(fragment, [work, ...(textures?.(fc) ?? [])], uniforms, region.width, region.height)`, then `ctx.reset()` and `drawImage` the returned image back into the work canvas immediately (the platform reuses its buffer).
7. Blit: on the destination context from `args`, draw the work canvas at `(region.x, region.y)` in layer space. If Step 1 found the context pre-transformed, wrap the blit in `save()` / `setTransform(1,0,0,1,0,0)` / `restore()`.

Cache: key the last output on `contentVersion(node)` plus the chain's param fingerprint plus `fc.frame`. A frame whose content version and fingerprint match the previous frame *and* whose effects are all time-invariant re-blits; flameWrap is time-varying, so it re-runs each frame while its SDF (Task 9) caches on content version alone.

- [x] **Step 5: Run the tests**

Run: `pnpm --filter @smoove/core test -- apply-draw`
Expected: all five PASS.

- [x] **Step 6: Call `initNodeEffects` during the frame pass**

In `packages/core/src/engine/sequence.ts`, inside `_apply`, after `this._kmRunFrame(local, true)` and before the draw, walk the subtree once and call `initNodeEffects` on any node whose `effects` attr is a non-empty array. Guard on a per-sequence "any effects seen" flag so a comp with no effects pays one `find` on the first frame only.

Add `applyLayerEffects(sequence)` to `apply.ts` for a Sequence-level chain: the layer canvas *is* the bitmap, so there is no capture step — read the chain off the Sequence, coalesce, run the groups against the layer context directly.

- [x] **Step 7: Checkpoint**

Run: `pnpm --filter @smoove/core build && pnpm --filter @smoove/core test && pnpm check`
Expected: pass.

---

## Task 8: Scaffold @smoove/effects

**Files:**
- Create: `packages/effects/package.json`, `packages/effects/tsconfig.json`, `packages/effects/vitest.config.ts`, `packages/effects/src/index.ts`, `packages/effects/README.md`
- Modify: `.changeset/config.json`, `tsconfig.json`, `AGENTS.md`

- [x] **Step 1: Create `packages/effects/package.json`**

Modelled on `packages/transitions/package.json`. Version matches the current fixed-group version (read it from `packages/core/package.json`).

```json
{
  "name": "@smoove/effects",
  "version": "0.3.6",
  "description": "Visual effects for smoove: animated fire that wraps any node's silhouette.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/smoove-dev/smoove.git",
    "directory": "packages/effects"
  },
  "homepage": "https://smoove.dev",
  "bugs": "https://github.com/smoove-dev/smoove/issues",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist *.tsbuildinfo",
    "prepublishOnly": "pnpm build"
  },
  "publishConfig": { "access": "public" },
  "peerDependencies": {
    "@smoove/core": "workspace:^",
    "konva": ">=10"
  },
  "devDependencies": {
    "skia-canvas": "^3.0.8",
    "vitest": "^3.2.4"
  }
}
```

`@smoove/core` is a **peer** dep, matching how renderer and studio treat it, so a consumer resolves exactly one core.

- [x] **Step 2: Create `packages/effects/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/test", "src/**/*.test.ts"],
  "references": [{ "path": "../core" }]
}
```

- [x] **Step 3: Create `packages/effects/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

No skia setup file: these tests are pure array and string math. The canvas-touching tests live in core and renderer.

- [x] **Step 4: Create the barrel**

`packages/effects/src/index.ts`:

```ts
export { flameWrap, type FlameWrapOptions } from "./flame-wrap.js";
```

This will not typecheck until Task 10. Create it now so the package structure is complete, and expect `pnpm build` to fail until then.

- [x] **Step 5: Register the package**

In `.changeset/config.json`, add `"@smoove/effects"` to the `fixed` array (all packages version in lockstep — required by `AGENTS.md`).

In the root `tsconfig.json`, add `{ "path": "packages/effects" }` to `references`.

In `AGENTS.md`, add a row to the layout table after `packages/transitions`:

```
packages/effects       @smoove/effects: visual effects for smoove. `flameWrap` wraps animated fire around any node's alpha silhouette via a single-pass fragment shader over a cached signed distance field. konva and core are peerDeps.
```

- [x] **Step 6: Install**

Run: `pnpm install`
Expected: succeeds, `packages/effects/node_modules` created.

> If vitest later fails with a missing `../skia.node`, the root `pnpm.onlyBuiltDependencies` has skipped skia-canvas's postinstall for the new package — copy the binary from another package's `node_modules/skia-canvas`.

- [x] **Step 7: Checkpoint**

Run: `pnpm check`
Expected: pass. `pnpm build` still fails on the empty barrel — that is expected until Task 10.

---

## Task 9: The chamfer SDF

The performance core. Alpha-silhouette flames need per-pixel distance to the element's edge; sampling alpha radially in-shader would cost ~128 texture fetches per pixel (~256M at 1080p). Instead compute an exact field on the CPU once per content version.

**Encoding:** two independent 8-bit channels, each linearly interpolable on its own (a hi/lo 16-bit split would interpolate to garbage across a hi transition and force `NEAREST`, losing smoothness):
- **R** = near field, ±16 device px, ~0.125 px per step — drives `melt`, `rim`, `ember`.
- **G** = far field, ±256 device px, 2 px per step — drives flame anchoring and `height` falloff.

Both store `0.5` at the silhouette edge, `> 0.5` outside, `< 0.5` inside.

**Files:**
- Create: `packages/effects/src/sdf.ts`
- Test: `packages/effects/src/sdf.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildSdf, decodeFar, decodeNear, NEAR_RANGE } from "./sdf.js";

/** Alpha bitmap helper: `w`x`h`, opaque inside `inside(x, y)`. */
function alpha(w: number, h: number, inside: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[(y * w + x) * 4 + 3] = inside(x, y) ? 255 : 0;
    }
  }
  return data;
}

describe("buildSdf", () => {
  it("returns RGBA of the same dimensions", () => {
    const out = buildSdf(alpha(8, 8, () => false), 8, 8);
    expect(out.length).toBe(8 * 8 * 4);
  });

  it("is ~0.5 at the edge of a filled square", () => {
    const w = 32;
    const inside = (x: number, y: number) => x >= 8 && x < 24 && y >= 8 && y < 24;
    const out = buildSdf(alpha(w, w, inside), w, w);
    // First inside pixel: distance to outside is ~0, so just under the midpoint.
    const d = decodeNear(out, w, 8, 16);
    expect(d).toBeGreaterThan(-1.5);
    expect(d).toBeLessThan(0.5);
  });

  it("grows negative toward the interior", () => {
    const w = 32;
    const inside = (x: number, y: number) => x >= 8 && x < 24 && y >= 8 && y < 24;
    const out = buildSdf(alpha(w, w, inside), w, w);
    expect(decodeNear(out, w, 16, 16)).toBeLessThan(decodeNear(out, w, 10, 16));
  });

  it("grows positive with distance outside", () => {
    const w = 64;
    const inside = (x: number, y: number) => x >= 28 && x < 36 && y >= 28 && y < 36;
    const out = buildSdf(alpha(w, w, inside), w, w);
    expect(decodeFar(out, w, 32, 20)).toBeGreaterThan(decodeFar(out, w, 32, 26));
  });

  it("approximates euclidean distance within chamfer tolerance", () => {
    const w = 64;
    // Half plane: inside where x >= 32, so distance at x is x - 32.
    const out = buildSdf(alpha(w, w, (x) => x >= 32), w, w);
    for (const x of [24, 28, 30]) {
      expect(Math.abs(decodeNear(out, w, x, 32) - (32 - x))).toBeLessThan(1);
    }
  });

  it("handles two disjoint blobs, taking the nearer edge", () => {
    const w = 64;
    const inside = (x: number, y: number) =>
      (x < 8 && y < 8) || (x >= 56 && y >= 56);
    const out = buildSdf(alpha(w, w, inside), w, w);
    expect(decodeNear(out, w, 10, 2)).toBeLessThan(NEAR_RANGE);
    expect(decodeNear(out, w, 32, 32)).toBe(NEAR_RANGE);
  });

  it("saturates rather than wrapping when nothing is opaque", () => {
    const w = 16;
    const out = buildSdf(alpha(w, w, () => false), w, w);
    expect(decodeNear(out, w, 8, 8)).toBe(NEAR_RANGE);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @smoove/effects test`
Expected: FAIL — cannot resolve `./sdf.js`.

- [x] **Step 3: Implement the chamfer transform**

```ts
/** Near-field half-range, device px. R channel resolution is NEAR_RANGE / 128. */
export const NEAR_RANGE = 16;
/** Far-field half-range, device px. G channel resolution is FAR_RANGE / 128. */
export const FAR_RANGE = 256;

const INF = 1e9;
/** Chamfer 3-4 weights: orthogonal 3, diagonal 4, divided by 3. */
const ORTH = 3;
const DIAG = 4;

/**
 * Unsigned distance (in chamfer units) from every pixel to the nearest seed,
 * by a two-pass 3-4 chamfer transform. `seed[i] === 1` marks a seed pixel.
 * O(n) — no per-pixel search.
 */
function chamfer(seed: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] === 1 ? 0 : INF;

  // Forward: top-left to bottom-right, reading the causal half-neighbourhood.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i] as number;
      if (y > 0) {
        if (x > 0) v = Math.min(v, (d[i - w - 1] as number) + DIAG);
        v = Math.min(v, (d[i - w] as number) + ORTH);
        if (x + 1 < w) v = Math.min(v, (d[i - w + 1] as number) + DIAG);
      }
      if (x > 0) v = Math.min(v, (d[i - 1] as number) + ORTH);
      d[i] = v;
    }
  }
  // Backward: bottom-right to top-left, reading the anti-causal half.
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i] as number;
      if (y + 1 < h) {
        if (x + 1 < w) v = Math.min(v, (d[i + w + 1] as number) + DIAG);
        v = Math.min(v, (d[i + w] as number) + ORTH);
        if (x > 0) v = Math.min(v, (d[i + w - 1] as number) + DIAG);
      }
      if (x + 1 < w) v = Math.min(v, (d[i + 1] as number) + ORTH);
      d[i] = v;
    }
  }
  return d;
}

function encode(signed: number, range: number): number {
  const t = 128 + (signed / range) * 128;
  return t < 0 ? 0 : t > 255 ? 255 : Math.round(t);
}

/**
 * Build a two-range signed distance field from the alpha channel of `rgba`.
 *
 * Returns RGBA where R is the near field (±{@link NEAR_RANGE} px) and G the far
 * field (±{@link FAR_RANGE} px), both centred on 128 at the silhouette edge,
 * above 128 outside and below inside. B and A are unused and set to 0 and 255.
 *
 * Two independently-interpolable channels rather than a 16-bit hi/lo split:
 * bilinear filtering across a hi-byte transition would produce garbage and
 * force NEAREST sampling, which a smooth field cannot afford.
 */
export function buildSdf(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const n = w * h;
  const insideSeed = new Uint8Array(n);
  const outsideSeed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // Seeds are boundary pixels of each region, so both transforms measure
    // distance to the silhouette rather than to the region itself.
    if ((rgba[i * 4 + 3] as number) >= 128) insideSeed[i] = 1;
    else outsideSeed[i] = 1;
  }

  const dOut = chamfer(insideSeed, w, h); // distance from outside pixels to inside
  const dIn = chamfer(outsideSeed, w, h); // distance from inside pixels to outside

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const isInside = insideSeed[i] === 1;
    const raw = isInside ? -(dIn[i] as number) : (dOut[i] as number);
    const signed = Math.abs(raw) >= INF ? (isInside ? -FAR_RANGE : FAR_RANGE) : raw / ORTH;
    out[i * 4] = encode(signed, NEAR_RANGE);
    out[i * 4 + 1] = encode(signed, FAR_RANGE);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function decodeNear(rgba: Uint8ClampedArray, w: number, x: number, y: number): number {
  return (((rgba[(y * w + x) * 4] as number) - 128) / 128) * NEAR_RANGE;
}

export function decodeFar(rgba: Uint8ClampedArray, w: number, x: number, y: number): number {
  return (((rgba[(y * w + x) * 4 + 1] as number) - 128) / 128) * FAR_RANGE;
}
```

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @smoove/effects test`
Expected: all seven PASS. If the edge-tolerance assertions are off by a fraction, adjust the *test* bounds to the chamfer's real error (3-4 chamfer is accurate to roughly 8%), not the implementation — but only after confirming the half-plane case is monotonic and correctly signed.

- [x] **Step 5: Add the cache**

Append to `sdf.ts` a cache keyed by node, storing `{ version, width, height, canvas }`. `sdfFor(node, capture, w, h, version)` returns the cached canvas when `version` and dimensions match, else rebuilds: `getImageData` on `capture`, `buildSdf`, `putImageData` into a dedicated canvas via `Konva.Util.createCanvasElement()`.

The SDF source canvas must be **separate from the work canvas and always CPU-backed** — the SDF build reads pixels, and reading back a GPU-rasterized skia surface is the path that corrupted under the old GL interop loop.

- [x] **Step 6: Checkpoint**

Run: `pnpm --filter @smoove/effects test && pnpm check`
Expected: pass.

---

## Task 10: The flameWrap factory

**Files:**
- Create: `packages/effects/src/params.ts`, `packages/effects/src/flame-wrap.ts`
- Test: `packages/effects/src/flame-wrap.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { flameWrap } from "./flame-wrap.js";

const fc = {
  frame: 30, time: 1, fps: 30, width: 256, height: 256, pixelRatio: 1,
};

describe("flameWrap", () => {
  it("carries the effect brand and is enabled by default", () => {
    const fx = flameWrap();
    expect(fx._fxEffect).toBe(true);
    expect(fx.enabled()).toBe(true);
  });

  it("is disabled at zero intensity", () => {
    expect(flameWrap({ intensity: 0 }).enabled()).toBe(false);
  });

  it("applies documented defaults", () => {
    const fx = flameWrap();
    expect(fx.height).toBe(170);
    expect(fx.spread).toBe(8);
    expect(fx.intensity).toBe(0.5);
    expect(fx.color).toEqual([1, 0.45, 0.1]);
  });

  it("pads asymmetrically: height up, spread sideways", () => {
    const p = flameWrap({ height: 100, spread: 10, turbulenceReach: 0, distortion: 0 })
      .padding(fc) as { top: number; right: number; bottom: number; left: number };
    expect(p.top).toBe(100);
    expect(p.right).toBe(10);
    expect(p.bottom).toBe(10);
    expect(p.left).toBe(10);
  });

  it("includes warp reach in padding on every side", () => {
    const p = flameWrap({ height: 100, spread: 10, turbulenceReach: 25, distortion: 10 })
      .padding(fc) as { top: number; right: number };
    expect(p.top).toBe(135);
    expect(p.right).toBe(45);
  });

  it("scales padding by pixelRatio", () => {
    const fx = flameWrap({ height: 100, spread: 10, turbulenceReach: 0, distortion: 0 });
    const p = fx.padding({ ...fc, pixelRatio: 2 }) as { top: number };
    expect(p.top).toBe(200);
  });

  it("emits exactly one shader pass", () => {
    const passes = flameWrap().passes(fc);
    expect(passes).toHaveLength(1);
    expect(passes[0]?.kind).toBe("shader");
  });

  it("drives u_time from the frame clock, not wall clock", () => {
    const a = flameWrap().passes(fc);
    const b = flameWrap().passes({ ...fc, frame: 60, time: 2 });
    const ua = (a[0] as { uniforms: Record<string, number> }).uniforms;
    const ub = (b[0] as { uniforms: Record<string, number> }).uniforms;
    expect(ua.u_time).toBe(1);
    expect(ub.u_time).toBe(2);
  });

  it("is pure in fc: same fc gives identical uniforms", () => {
    const fx = flameWrap();
    const first = (fx.passes(fc)[0] as { uniforms: unknown }).uniforms;
    const second = (fx.passes(fc)[0] as { uniforms: unknown }).uniforms;
    expect(second).toEqual(first);
  });

  it("converts px params to device px in uniforms", () => {
    const fx = flameWrap({ height: 100 });
    const u = (fx.passes({ ...fc, pixelRatio: 2 })[0] as {
      uniforms: Record<string, number>;
    }).uniforms;
    expect(u.u_height).toBe(200);
  });

  it("rejects a color that is not three numbers", () => {
    expect(() => flameWrap({ color: [1, 0] as never })).toThrow(/color/i);
  });

  it("clamps intensity into range instead of throwing", () => {
    expect(flameWrap({ intensity: 99 }).intensity).toBe(3);
  });

  it("invalidates its attached node when a param is set", () => {
    const fx = flameWrap();
    const node = { _fxInvalidate: vi.fn() } as never;
    fx.attach(node);
    fx.intensity = 1.2;
    expect((node as { _fxInvalidate: ReturnType<typeof vi.fn> })._fxInvalidate)
      .toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @smoove/effects test -- flame-wrap`
Expected: FAIL — cannot resolve `./flame-wrap.js`.

- [x] **Step 3: Implement `params.ts`**

A `defineParams` helper that, given a spec of `{ name: { default, min?, max? } }`, returns a mutable object with accessor properties: each setter clamps to `[min, max]`, stores the value, and calls `_fxInvalidate()` on every attached node. Also exports `attachTo`/`detachFrom` list management and re-exports `fingerprint` from core for the chain fingerprint.

- [x] **Step 4: Implement `flame-wrap.ts`**

`FlameWrapOptions` with all 20 params (the reference's 21 minus `radius`, which exists to shape an analytic box). Defaults per the spec table. `flameWrap(options?)` builds the params object, then returns an object that also implements `SmooveEffect`:

- `enabled()` → `intensity > 0`
- `padding(fc)` → the derivation below, times `fc.pixelRatio`:
  ```
  warp   = turbulenceReach + distortion
  top    = height + warp
  right  = spread + warp
  bottom = spread + warp
  left   = spread + warp
  ```
- `passes(fc)` → one `shader` pass: `{ kind: "shader", fragment: FLAME_WRAP_FRAG, uniforms, textures }`, where `textures(fc)` returns `[sdfFor(...)]` and `uniforms` are the params converted to device px (every px-valued param times `fc.pixelRatio`), plus `u_time: fc.time`, `u_resolution: [fc.width, fc.height]`, `u_pixelRatio: fc.pixelRatio`.
- `attach`/`detach` → param list management.

`FLAME_WRAP_FRAG` is imported from `./glsl/flame-wrap.frag.js` and does not exist until Task 11 — stub it as `export const FLAME_WRAP_FRAG = "";` there now so this task's tests can run.

- [x] **Step 5: Run the tests**

Run: `pnpm --filter @smoove/effects test -- flame-wrap`
Expected: all thirteen PASS.

- [x] **Step 6: Checkpoint**

Run: `pnpm build && pnpm --filter @smoove/effects test && pnpm check`
Expected: pass. The barrel from Task 8 now typechecks.

---

## Task 11: The fragment shader

Written from scratch. Canvas UI's fragment source is not a copy target — the technique (layered fbm over a silhouette field, hash-based sparks) is standard shader craft.

**The GLSL-100 constraint is not a style preference.** `transpileTo100` is four string rewrites: strip `#version 300 es`, `out vec4 X` → `gl_FragColor`, `in` → `varying`, `texture(` → `texture2D(`. Anything else WebGL2-only reaches headless-gl unchanged and fails to compile at server-render time.

Banned outright: `floatBitsToUint`, `uint`/`uvec`, `<<`, `>>`, `^`, `&`, `|`, `%`, `round()`, `trunc()`, `switch`, `textureLod`, `textureGrad`, `inverse()`, `transpose()`, non-constant loop bounds, dynamic array indexing.

**Files:**
- Create: `packages/effects/src/glsl/flame-wrap.frag.ts`
- Test: `packages/effects/src/glsl/dialect.test.ts`

- [x] **Step 1: Write the failing dialect test**

```ts
import { transpileTo100 } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { FLAME_WRAP_FRAG } from "./flame-wrap.frag.js";

const BANNED: Array<[string, RegExp]> = [
  ["floatBitsToUint", /floatBitsTo(U|I)nt/],
  ["uint/uvec types", /\b(uint|uvec[234])\b/],
  ["bit shift", /<<|>>/],
  ["bitwise xor/and/or", /[^&|]&[^&]|[^|]\|[^|]|\^/],
  ["integer modulo", /%/],
  ["round()", /\bround\s*\(/],
  ["trunc()", /\btrunc\s*\(/],
  ["switch", /\bswitch\s*\(/],
  ["textureLod/Grad", /\btexture(Lod|Grad)\s*\(/],
  ["inverse/transpose", /\b(inverse|transpose)\s*\(/],
];

describe("flame-wrap fragment dialect", () => {
  it("declares itself as GLSL ES 3.00", () => {
    expect(FLAME_WRAP_FRAG.startsWith("#version 300 es")).toBe(true);
  });

  it("uses only constructs transpileTo100 can downgrade", () => {
    for (const [label, re] of BANNED) {
      expect(re.test(FLAME_WRAP_FRAG), `banned construct: ${label}`).toBe(false);
    }
  });

  it("uses texture() so the rewrite catches it", () => {
    expect(FLAME_WRAP_FRAG).toMatch(/\btexture\s*\(/);
    expect(FLAME_WRAP_FRAG).not.toMatch(/\btexture2D\s*\(/);
  });

  it("uses only constant-bound loops", () => {
    for (const m of FLAME_WRAP_FRAG.matchAll(/for\s*\(([^)]*)\)/g)) {
      expect(m[1], `non-constant loop bound: ${m[0]}`).toMatch(/<\s*\d+\s*;/);
    }
  });

  it("transpiles to GLSL 100 with no leftover 3.00 syntax", () => {
    const out = transpileTo100(FLAME_WRAP_FRAG);
    expect(out).not.toMatch(/#version/);
    expect(out).not.toMatch(/\bout\s+vec4\b/);
    expect(out).toMatch(/gl_FragColor/);
    expect(out).toMatch(/\bvarying\s+vec2\s+v_uv/);
    expect(out).toMatch(/\btexture2D\s*\(/);
  });

  it("declares every uniform the factory sets", () => {
    for (const name of [
      "u_tex0", "u_sdf", "u_time", "u_resolution", "u_pixelRatio",
      "u_color", "u_intensity", "u_height", "u_spread", "u_speed", "u_scale",
      "u_turbulence", "u_turbulenceScale", "u_turbulenceReach",
      "u_sparks", "u_sparkSize", "u_sparkDensity", "u_sparkSpeed",
      "u_rim", "u_melt", "u_distortion", "u_smoke", "u_ember", "u_scorch",
    ]) {
      expect(FLAME_WRAP_FRAG, `missing uniform ${name}`)
        .toMatch(new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`));
    }
  });
});
```

The bitwise regex is deliberately loose and will need tightening against the real source so it does not flag `&&` or `||`. Tighten the *test*, keep the intent.

- [x] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @smoove/effects test -- dialect`
Expected: FAIL — the Task 10 stub is an empty string.

- [x] **Step 3: Write the fragment header, uniforms and GLSL-100-safe noise**

Replace the stub in `packages/effects/src/glsl/flame-wrap.frag.ts`:

```ts
/**
 * flameWrap's fragment. Authored in `#version 300 es` but restricted to the
 * subset `transpileTo100` can mechanically downgrade, because the server path
 * (headless-gl) is WebGL1 only. See `glsl/dialect.test.ts` for the guard.
 *
 * Inputs:
 *   u_tex0 — captured node content, straight alpha
 *   u_sdf  — R: near field ±16 device px, G: far field ±256, 0.5 at the edge
 */
export const FLAME_WRAP_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_tex0;
uniform sampler2D u_sdf;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform vec3 u_color;
uniform float u_intensity;
uniform float u_height;
uniform float u_spread;
uniform float u_speed;
uniform float u_scale;
uniform float u_turbulence;
uniform float u_turbulenceScale;
uniform float u_turbulenceReach;
uniform float u_sparks;
uniform float u_sparkSize;
uniform float u_sparkDensity;
uniform float u_sparkSpeed;
uniform float u_rim;
uniform float u_melt;
uniform float u_distortion;
uniform float u_smoke;
uniform float u_ember;
uniform float u_scorch;

const float NEAR_RANGE = 16.0;
const float FAR_RANGE = 256.0;

// Float-only hash. No bit tricks: GLSL ES 1.00 has no integer bit operators.
float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453123);
}
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise with quintic smoothing — cheaper than simplex and adequate once
// several octaves are stacked.
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Four octaves, constant bound, each rotated to break axis alignment.
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return sum;
}

float sdfNear(vec2 uv) {
  return (texture(u_sdf, uv).r - 0.5) * 2.0 * NEAR_RANGE;
}
float sdfFar(vec2 uv) {
  return (texture(u_sdf, uv).g - 0.5) * 2.0 * FAR_RANGE;
}
`;
```

- [x] **Step 4: Run the dialect test against the header**

Run: `pnpm --filter @smoove/effects test -- dialect`
Expected: the version, texture, loop-bound and transpile assertions PASS; the uniform-coverage assertion PASSES. It will still fail only if a banned construct slipped in — fix the shader, not the test.

- [x] **Step 5: Add the `main()` composite**

Append to the template string, in this order (each term reads the fields above; the ordering is what makes it read as fire rather than as noise):

1. **Heat coordinate.** `vec2 p = v_uv * u_resolution / u_pixelRatio;` then a flow coordinate that rises: `vec2 q = p * mix(0.02, 0.08, u_scale); q.y += u_time * u_speed * 40.0;`
2. **Turbulence warp.** `q += u_turbulence * vec2(fbm(q * u_turbulenceScale), fbm(q * u_turbulenceScale + 5.2)) * 2.0 - u_turbulence;`
3. **Flame field.** `float n = fbm(q);` gated by the far field so flames only exist near and above the silhouette: `float reach = 1.0 - clamp(sdfFar(v_uv) / max(u_height, 1.0), 0.0, 1.0);` biased upward so fire climbs rather than haloing.
4. **Heat.** `float heat = clamp(n * reach * u_intensity * 2.0, 0.0, 1.0);`
5. **Content sample with heat distortion**, confined to `u_turbulenceReach` of the edge: offset `v_uv` by `u_distortion / u_resolution` scaled by the warp field and by `1.0 - clamp(abs(sdfNear(v_uv)) / max(u_turbulenceReach, 1.0), 0.0, 1.0)`.
6. **Melt.** Erode content alpha where `sdfNear < u_melt * (noise - 0.5)`, so the edge is eaten unevenly.
7. **Scorch.** Darken content by `u_scorch` as a function of proximity to the melted edge.
8. **Colour ramp.** Three-stop ramp from `u_color` through a hotter mix toward white, driven by `heat`.
9. **Rim / ember.** Add `u_rim` at `abs(sdfNear) < 1.5` and `u_ember` in a wider band inside the edge.
10. **Sparks.** Cell-hash points: quantize `q` to a grid scaled by `u_sparkDensity`, `hash21` the cell for a per-spark phase, position via `fract(u_time * u_sparkSpeed + phase)` so each spark's life is a closed-form function of time with no accumulation, size by `u_sparkSize`, brightness by `u_sparks`.
11. **Smoke.** A second lower-frequency fbm above the flame tips, alpha-only, weighted by `u_smoke`.
12. **Composite.** Fire and content into `fragColor` with straight alpha. Flames both behind and in front resolve inside the shader — the pass output *replaces* the node's pixels, so no external `destination-over` is needed.

- [x] **Step 6: Re-run the dialect test**

Run: `pnpm --filter @smoove/effects test`
Expected: all PASS.

- [x] **Step 7: Checkpoint**

Run: `pnpm build && pnpm --filter @smoove/effects test && pnpm check`
Expected: pass. Note that nothing has yet *rendered* the shader — visual truth arrives in Task 13.

---

## Task 12: Server-side compile and the no-GL fallback

The dialect test is a static guard. This task proves the fragment actually compiles on the server's WebGL1 context, and that a missing platform degrades instead of crashing.

**Files:**
- Create: `packages/renderer/src/effects.test.ts`
- Modify: `packages/renderer/src/render.ts` (CPU-pin rule)

- [x] **Step 1: Write the failing test**

```ts
import { FLAME_WRAP_FRAG } from "@smoove/effects";
import { describe, expect, it } from "vitest";
import { createNodeGlPlatform } from "./gl-node.js";

describe("flameWrap on the server GL platform", () => {
  it("compiles through headless-gl WebGL1", () => {
    const platform = createNodeGlPlatform();
    if (!platform) {
      throw new Error("headless-gl unavailable: this test must not be skipped silently");
    }
    const gl = platform.gl;
    const src = platform.prepareFragment(FLAME_WRAP_FRAG);
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!shader) throw new Error("could not create shader");
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    expect(gl.getShaderInfoLog(shader) ?? "").toBe("");
    expect(gl.getShaderParameter(shader, gl.COMPILE_STATUS)).toBe(true);
  });
});
```

`FLAME_WRAP_FRAG` must be exported from the effects barrel for this — add it to `packages/effects/src/index.ts`, documented as internal-but-exported for cross-package testing.

- [x] **Step 2: Run it**

Run: `pnpm --filter @smoove/renderer test -- effects`
Expected: FAIL initially — either the export is missing, or the compile log names a construct the dialect test's regexes did not catch. **This is the test that matters most in the whole plan**; a real compile log is worth more than any static check. Fix the shader until it compiles clean.

- [x] **Step 3: Pin shader chains to CPU**

In the renderer's frame loop, where the effects work canvas mode is chosen, implement the refined rule: a chain of only `css`/`composite` passes may use a `gpu: true` canvas; a chain containing any `pixels` **or** `shader` pass is CPU-pinned. The reason belongs in a comment: `uploadScene` in `gl-node.ts` does `getImageData` on the source canvas, so a shader pass fully reads the work canvas back, and GPU-skia readback is what corrupted under the old GL interop loop.

Ensure the per-frame `ctx.reset()` discipline covers both the pooled capture canvases and the SDF canvas.

- [x] **Step 4: Add the no-platform test**

In `packages/core/src/effects/apply-draw.test.ts`, add a case that calls `setCompositorFactory(() => null)`, attaches an effect emitting one `shader` pass, draws, and asserts: the node still drew its own content, the frame is not blank, and `console.warn` fired exactly once across two draws.

- [x] **Step 5: Run both**

Run: `pnpm --filter @smoove/renderer test && pnpm --filter @smoove/core test`
Expected: pass.

- [x] **Step 6: Checkpoint**

Run: `pnpm build && pnpm check`
Expected: pass.

---

## Task 13: Determinism and visual truth

**Files:**
- Create: `packages/renderer/src/effects-determinism.test.ts`
- Create: `packages/kitchen-sink/src/compositions/flame-wrap.ts`
- Modify: `packages/kitchen-sink/src/registry.ts`

- [x] **Step 1: Write the determinism test**

Build a small comp (a `Text` with `flameWrap`) and assert that frame 90 rendered cold is byte-identical to frame 90 reached by stepping from 0:

```ts
import { describe, expect, it } from "vitest";

function hashOf(comp: import("@smoove/core").Composition, frame: number): string {
  comp.setFrame(frame);
  const canvas = comp.captureCanvas();
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + (d[i] as number)) | 0;
  return String(h);
}

describe("flameWrap determinism", () => {
  it("frame 90 cold equals frame 90 stepped", async () => {
    const cold = hashOf(await buildComp(), 90);
    const warm = await buildComp();
    for (let f = 0; f <= 90; f++) warm.setFrame(f);
    expect(hashOf(warm, 90)).toBe(cold);
  });

  it("differs across frames, so it is actually animating", async () => {
    const comp = await buildComp();
    expect(hashOf(comp, 30)).not.toBe(hashOf(comp, 60));
  });

  it("is not blank", async () => {
    const comp = await buildComp();
    comp.setFrame(45);
    const canvas = comp.captureCanvas();
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if ((d[i] as number) > 0) opaque++;
    expect(opaque).toBeGreaterThan(0);
  });
});
```

`buildComp()` constructs the composition inline. Follow `doc/`'s headless recipe: never cache or draw at module-eval time.

- [x] **Step 2: Run it**

Run: `pnpm --filter @smoove/renderer test -- determinism`
Expected: the first two PASS. If cold ≠ stepped, there is accumulated state — find it before continuing; that is the bug this whole design exists to prevent.

- [x] **Step 3: Build the kitchen-sink demo**

**Invoke the `smoove-video` skill before writing this composition** — repo rule, no exceptions. Then create `packages/kitchen-sink/src/compositions/flame-wrap.ts`: a burning title on a dark background, with `intensity` interpolated 0 → 0.8 over the first 20 frames so ignition is visible, and register it in `packages/kitchen-sink/src/registry.ts`.

- [x] **Step 4: Verify in the browser**

Run `pnpm build`, then start the studio via the preview tooling (not Bash), open the `flame-wrap` composition, and check:
- flames render and animate;
- scrubbing to an arbitrary frame matches playing to it;
- no console errors;
- flames appear outside the title's bounding box (padding works);
- the WebGL2 path looks right — this is the only place WebGL2 correctness is checked, since headless-gl is WebGL1-only.

Screenshot the result for the maintainer. This is where the shader's artistic tuning happens: adjust the `main()` constants from Task 11 Step 5 against what you see.

- [x] **Step 5: Render an mp4**

Use the kitchen-sink render queue to produce a short mp4 of the demo, confirming the server path matches preview. Report the measured per-frame cost.

- [x] **Step 6: Checkpoint**

Run: `pnpm build && pnpm check && pnpm --filter @smoove/core test && pnpm --filter @smoove/effects test && pnpm --filter @smoove/renderer test`
Expected: all pass.

---

## Task 14: Docs, skill and changeset

**Files:**
- Create: `packages/docs/content/docs/effects.mdx`, `packages/docs/src/demos/flame-wrap.ts`
- Modify: `packages/docs/content/docs/meta.json`, `skills/smoove-video/SKILL.md`
- Create: `.changeset/flame-wrap.md`

- [x] **Step 1: Write the docs page**

**Invoke the `smoove-writing` skill first** — repo rule for any smoove prose.

`packages/docs/content/docs/effects.mdx` covers: what `flameWrap` does; the six taught params (`color`, `intensity`, `height`, `speed`, `turbulence`, `sparks`); a full reference table of all 20; a live `<Demo name="flame-wrap" />`; and three honest notes:
- **Put it on a node, not a Sequence.** A shader chain reads its work canvas back every frame, so cost scales with the padded region — a Sequence-level burn is a full-frame readback per frame. This is the opposite of the general effects guidance.
- **Clipping.** A node inside a `Group` with a `clipFunc`, or a Sequence-level burn at the stage edge, has its flames cut: the padded region cannot exceed the surface being drawn into.
- **No GL, no flames.** The node draws normally and a warning is logged.

Add the page to `meta.json` and create the demo module.

- [x] **Step 2: Update the skill**

Add an effects section to `skills/smoove-video/SKILL.md`: `node.effects([flameWrap({...})])`, animate params in a frame callback, node-not-Sequence, and that `intensity` is the ignite knob.

- [x] **Step 3: Verify the docs build**

Run: `pnpm --filter @smoove/docs build`
Expected: succeeds. Then check the page renders and the demo animates via the preview tooling.

- [x] **Step 4: Write the changeset**

`.changeset/flame-wrap.md`. Per the repo's pre-1.0 convention, **minor** means breaking and additive features are **patch** — but the GL bridge move changes core's public surface (additively, since transitions re-exports), and `padding` widens the contract. Both are additive, so patch across the fixed group:

```markdown
---
"@smoove/core": patch
"@smoove/effects": patch
"@smoove/transitions": patch
"@smoove/renderer": patch
---

Add `@smoove/effects` with `flameWrap`: animated fire that wraps any node's alpha silhouette, with heat distortion, sparks, molten rim, smoke and scorch. Core gains the `effects` attr on nodes and Sequences, and the WebGL bridge moves from `@smoove/transitions` into core (re-exported, so nothing breaks).
```

- [x] **Step 5: Flag the maintainer task in the PR body**

`@smoove/effects` is a new publishable package, so it needs a one-time npm trusted-publisher registration (steps in `RELEASING.md`). That is the maintainer's to do — call it out explicitly.

- [x] **Step 6: Final checkpoint**

Run: `pnpm build && pnpm check && pnpm -r test`
Expected: all pass. Leave everything in the working tree; do not commit.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: decision 1 (alpha silhouette) → Tasks 9, 11; decision 2 (all params) → Task 10; decision 3 (no-GL warn) → Task 12 Step 4; decision 4 (per-side padding) → Tasks 4, 10. Deviation 1 → Task 2; deviation 2 → Task 3; deviation 3 → Task 3 (documented as deferred); deviation 4 → Task 12 Step 3. Cached SDF → Task 9. Shader constraints → Task 11 + Task 12 Step 2. API/params table → Task 10. Padding derivation → Task 10 Step 4. Limitations → Task 14 Step 1. Server rendering → Task 12. `gl-node` prerequisite → Task 1. All seven test categories → Tasks 3–13. Every repo chore → Tasks 1, 8, 14.

**Known soft spots, stated rather than hidden.**
- **Task 7 Step 4** describes `drawNodeWithEffects` as numbered prose, not literal code, because its correctness depends on facts the Step 1 spike establishes about Konva's `drawScene` contract. Writing invented code there would be worse than an honest instruction.
- **Task 11 Step 5** specifies `main()` as ordered terms with the field math rather than final GLSL. A fire shader's constants are tuned against pixels; the plan gives the structure and Task 13 Step 4 is where it becomes good. Claiming 200 tuned lines up front would be fiction.
- The Task 9 tolerance assertions may need widening to the 3-4 chamfer's real ~8% error. The step says to fix the bounds only after confirming sign and monotonicity.

**Type consistency.** `EffectFrameContext`, `EffectPass`, `EffectPadding`/`EffectPaddingBox`, `SmooveEffect`, `PassGroup`, `Rect` are defined in Tasks 4/6 and used unchanged after. `renderPass(fragment, sources, uniforms, width, height)` keeps one signature across Tasks 3, 7, 10. `buildSdf`/`decodeNear`/`decodeFar`/`NEAR_RANGE`/`FAR_RANGE` match between `sdf.ts`, its test, and the fragment's decode helpers. `contentVersion`/`bumpContentVersion`/`isTranslationOnly`/`fingerprint` are consistent across Tasks 5, 7, 9. `initNodeEffects`/`disposeNodeEffects`/`applyLayerEffects` are named identically in Tasks 6, 7 and the spec. `FLAME_WRAP_FRAG` is stubbed in Task 10 Step 4 before its real definition in Task 11 and its cross-package export in Task 12, so no task references a symbol that does not yet exist.
