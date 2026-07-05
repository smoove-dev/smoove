# Shader Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hardware-accelerated shader effects for smoove: an `effects: [...]` prop on every node and Sequence, plus generative shader-source nodes, backed by one shared WebGL2 context in the browser and headless-gl on the server.

**Architecture:** `@smoove/core` gains a small open contract (`KMEffect`) + draw interception, mirroring `KMLayoutNode`. A new `@smoove/effects` package owns the GL runtime (program cache, ping-pong framebuffers), the `Effect` base class with schema-generated Konva-style accessors, the `ShaderSource` node base, and the catalog (8 filters + 4 paper-shaders source ports). `@smoove/renderer/gl` injects its existing headless-gl platform into the effects runtime.

**Tech Stack:** TypeScript ESM, Konva 10, WebGL2 (GLSL ES 3.00 transpiled to 1.00 for headless-gl), Vitest (first tests in the repo), pnpm workspaces, `tsc -b`.

**Spec:** `docs/superpowers/specs/2026-07-04-shader-effects-design.md`

---

## ⚠️ Repo overrides (read first)

- **NEVER `git commit` or push.** AGENTS.md forbids it and it overrides this plan template's commit steps. Every "Commit" step from the standard task shape is intentionally absent. Leave all changes in the working tree.
- The demo imports **built** package entries: after editing `packages/*/src`, run `pnpm build` (or keep `tsc -b --watch` running) before checking the demo.
- Biome for lint/format: run `pnpm check` at the end of each task; fix with `pnpm format`.
- Konva quirk used throughout: unknown config keys (like `effects`) pass through to `node.attrs` automatically; `setAttr("x", v)` fires an `xChange` event.

Common commands:

```bash
pnpm --filter @smoove/core build      # tsc -b one package
pnpm --filter @smoove/effects test    # vitest run (after Task 6)
pnpm build                            # all packages
pnpm check                            # biome
```

---

## Phase A — core contract & interception

### Task 1: Core effect contract

**Files:**
- Create: `packages/core/src/effects/contract.ts`
- Modify: `packages/core/src/index.ts` (barrel)

- [ ] **Step 1: Create the contract file**

```ts
// packages/core/src/effects/contract.ts
import type Konva from "konva";

/** A GL uniform value: float, bool, vecN (`number[]`), or an array of vecNs (`number[][]`, e.g. `vec4 u_colors[8]`). */
export type UniformValue = number | boolean | number[] | number[][];
export type EffectUniforms = Record<string, UniformValue>;

/** One fragment-shader pass. `fragment` doubles as the runtime's program-cache key. */
export type EffectPass = { fragment: string; uniforms: EffectUniforms };

/** Frame context handed to {@link KMEffect._kmPasses}. All time-like values derive from the composition clock — never wall clock — so server renders are pixel-identical. */
export interface EffectFrameContext {
  frame: number;
  /** `frame / fps`, seconds. */
  time: number;
  fps: number;
  /** Texture size in px (stage size for node effects, device px for layer effects). */
  width: number;
  height: number;
  pixelRatio: number;
}

/**
 * The open contract that lets core apply a shader effect without knowing GL.
 * Implemented by `@smoove/effects`' `Effect` base class; anything implementing
 * it can be handed to a node's `effects: [...]` config.
 */
export interface KMEffect {
  readonly _kmEffect: true;
  enabled(): boolean;
  /** The shader passes this effect contributes this frame (a blur is two). */
  _kmPasses(ctx: EffectFrameContext): EffectPass[];
  /** Bookkeeping so param setters can `batchDraw()` owning layers. */
  _kmAttach(node: Konva.Node): void;
  _kmDetach(node: Konva.Node): void;
}

export function isKMEffect(v: unknown): v is KMEffect {
  return typeof v === "object" && v !== null && (v as Partial<KMEffect>)._kmEffect === true;
}

/** Convenience for wrapper config types. */
export type WithEffects<T> = T & { effects?: KMEffect[] };

/**
 * The GL executor injected by `@smoove/effects` (browser WebGL2) or a server
 * renderer (headless-gl). Core never touches GL itself.
 */
export interface KMEffectRuntime {
  /**
   * Run `passes` over `input` (uploaded once; also bound as `u_original` for
   * composite passes). Returns an image to draw immediately (reused across
   * calls), or `null` on failure (compile error, context lost).
   */
  applyChain(
    input: CanvasImageSource,
    passes: EffectPass[],
    width: number,
    height: number,
  ): CanvasImageSource | null;
  /** Render a generative pass with no input texture (ShaderSource nodes). */
  renderSource(pass: EffectPass, width: number, height: number): CanvasImageSource | null;
  dispose(): void;
}

let runtime: KMEffectRuntime | null = null;

/** Called by `@smoove/effects` (auto, on first effect construction) or tests. */
export function setEffectRuntime(r: KMEffectRuntime | null): void {
  runtime = r;
}

export function getEffectRuntime(): KMEffectRuntime | null {
  return runtime;
}
```

- [ ] **Step 2: Export from the barrel**

In `packages/core/src/index.ts`, add (alphabetical position near the `layout/contract.js` exports):

```ts
export {
  type EffectFrameContext,
  type EffectPass,
  type EffectUniforms,
  getEffectRuntime,
  isKMEffect,
  type KMEffect,
  type KMEffectRuntime,
  setEffectRuntime,
  type UniformValue,
  type WithEffects,
} from "./effects/contract.js";
```

- [ ] **Step 3: Build + lint**

Run: `pnpm --filter @smoove/core build && pnpm check`
Expected: clean build, no Biome errors.

---

### Task 2: Core draw-interception helpers

**Files:**
- Create: `packages/core/src/effects/apply.ts`

- [ ] **Step 1: Create the helper module**

```ts
// packages/core/src/effects/apply.ts
import type Konva from "konva";
import { getComposition } from "../engine/composition.js";
import {
  type EffectFrameContext,
  type EffectPass,
  getEffectRuntime,
  isKMEffect,
  type KMEffect,
} from "./contract.js";

/** Nodes currently being captured via `toCanvas` — guards drawScene re-entry. */
const capturing = new WeakSet<Konva.Node>();

let warnedNoRuntime = false;
let warnedKonvaFilters = false;

function warnNoRuntimeOnce(): void {
  if (warnedNoRuntime) return;
  warnedNoRuntime = true;
  console.warn(
    "[smoove] a node has `effects` but no effect runtime is registered — install @smoove/effects and construct at least one effect (or, on the server, import \"@smoove/renderer/gl\"). Drawing unfiltered.",
  );
}

function effectFrameContext(
  stage: Konva.Stage,
  width: number,
  height: number,
  pixelRatio: number,
): EffectFrameContext {
  const comp = getComposition(stage);
  const frame = comp ? comp.frame.get() : 0;
  const fps = comp ? comp.fps : 30;
  return { frame, time: frame / fps, fps, width, height, pixelRatio };
}

function enabledPasses(effects: KMEffect[], ctx: EffectFrameContext): EffectPass[] {
  const passes: EffectPass[] = [];
  for (const e of effects) {
    if (isKMEffect(e) && e.enabled()) passes.push(...e._kmPasses(ctx));
  }
  return passes;
}

/**
 * Wire a node constructed with `effects` in its config: run attach bookkeeping
 * now, keep it in sync on later `node.effects([...])` writes, and nudge users
 * off deprecated Konva CPU filters.
 */
export function initNodeEffects(node: Konva.Node): void {
  let prev: KMEffect[] = [];
  const sync = () => {
    const next = ((node.getAttr("effects") as KMEffect[] | undefined) ?? []).filter(isKMEffect);
    for (const e of prev) {
      if (!next.includes(e)) e._kmDetach(node);
    }
    for (const e of next) {
      if (!prev.includes(e)) e._kmAttach(node);
    }
    prev = next;
  };
  sync();
  node.on("effectsChange", sync);

  const warnFilters = () => {
    if (warnedKonvaFilters) return;
    warnedKonvaFilters = true;
    console.warn(
      "[smoove] Konva `filters`/`cache()` are CPU-based and deprecated for smoove nodes — use `effects: [...]` from @smoove/effects instead.",
    );
  };
  if (node.getAttr("filters") !== undefined) warnFilters();
  node.on("filtersChange", warnFilters);
}

/**
 * Effected draw path for a node (Shape or Group). Returns `true` when it drew
 * the shader output (caller must skip the normal draw), `false` to fall back.
 *
 * v1 renders the subtree in **stage space at pixelRatio 1** (spec: layer-space
 * tradeoff) — blur/glow can bleed anywhere on the layer and transforms are
 * trivial. Per-node bounding-box textures are a deferred optimization.
 */
export function drawNodeWithEffects(
  node: Konva.Node,
  can?: { isCache?: boolean; getContext(): Konva.Context },
): boolean {
  if (capturing.has(node)) return false;
  const effects = node.getAttr("effects") as KMEffect[] | undefined;
  if (!effects || effects.length === 0) return false;
  const runtime = getEffectRuntime();
  if (!runtime) {
    warnNoRuntimeOnce();
    return false;
  }
  const stage = node.getStage();
  const layer = node.getLayer();
  if (!stage || !layer) return false;
  const canvas = can ?? layer.getCanvas();
  if (canvas.isCache) return false; // inside Konva cache() — stay out of its way

  const width = stage.width();
  const height = stage.height();
  if (width <= 0 || height <= 0) return false;
  const ctx = effectFrameContext(stage, width, height, 1);
  const passes = enabledPasses(effects, ctx);
  if (passes.length === 0) return false;

  capturing.add(node);
  let captured: HTMLCanvasElement;
  try {
    // Stage-space capture: absolute transform + absolute opacity baked in.
    captured = node.toCanvas({ x: 0, y: 0, width, height, pixelRatio: 1 });
  } finally {
    capturing.delete(node);
  }

  const out = runtime.applyChain(captured, passes, width, height);
  if (!out) return false;

  // Current context transform here is the layer base (pixelRatio scale):
  // children apply their own absolute transform inside save/restore, so a
  // stage-space image drawn at (0,0) lands exactly.
  const context = canvas.getContext();
  context.save();
  context.drawImage(out, 0, 0, width, height);
  context.restore();
  return true;
}

/**
 * Post-pass for a Sequence (layer-wide effects): run the chain over the
 * layer's own canvas in device pixels and blit the result back.
 */
export function applyLayerEffects(
  layer: Konva.Layer,
  can?: { isCache?: boolean; width: number; height: number; pixelRatio: number; getContext(): Konva.Context; _canvas: HTMLCanvasElement },
): boolean {
  const effects = layer.getAttr("effects") as KMEffect[] | undefined;
  if (!effects || effects.length === 0) return false;
  const runtime = getEffectRuntime();
  if (!runtime) {
    warnNoRuntimeOnce();
    return false;
  }
  const stage = layer.getStage();
  if (!stage) return false;
  const canvas = can ?? (layer.getCanvas() as unknown as NonNullable<typeof can>);
  if (!canvas || canvas.isCache) return false;
  const w = canvas.width; // device px
  const h = canvas.height;
  if (w <= 0 || h <= 0) return false;
  const ctx = effectFrameContext(stage, w, h, canvas.pixelRatio ?? 1);
  const passes = enabledPasses(effects, ctx);
  if (passes.length === 0) return false;

  const out = runtime.applyChain(canvas._canvas, passes, w, h);
  if (!out) return false;

  const raw = canvas.getContext()._context;
  raw.save();
  raw.setTransform(1, 0, 0, 1, 0, 0);
  raw.clearRect(0, 0, w, h);
  raw.drawImage(out, 0, 0, w, h);
  raw.restore();
  return true;
}
```

Notes for the implementer:
- `Konva.Context` exposes `save/restore/drawImage` and the raw 2D context as `_context` — both used above are real Konva 10 APIs.
- `node.toCanvas(...)` internally calls `node.drawScene(scratchCanvas, ...)`, which re-enters our override — that is exactly what the `capturing` WeakSet guards. Do not remove it or you get infinite recursion.
- These helpers are **internal**: do not export them from the barrel; wrappers import from `../effects/apply.js` directly.

- [ ] **Step 2: Build + lint**

Run: `pnpm --filter @smoove/core build && pnpm check`
Expected: clean. (Type errors around the structural `can` params are fixable with `as` casts at call sites — keep the casts in the callers, not here.)

---

### Task 3: `effects` on shape wrappers (FlexShape mixin)

**Files:**
- Modify: `packages/core/src/layout/flex/mixin.ts` (the `Wrapped` class, lines ~113–129)

- [ ] **Step 1: Wire the mixin**

Add imports at the top of `mixin.ts`:

```ts
import { drawNodeWithEffects, initNodeEffects } from "../../effects/apply.js";
import type { KMEffect } from "../../effects/contract.js";
```

Add `effects` to the doc surface by extending `LeafConfig`:

```ts
export type LeafConfig = FlexChildProps & {
  width?: SizeValue;
  height?: SizeValue;
  effects?: KMEffect[];
} & Record<string, unknown>;
```

Inside the `Wrapped` class, after `applyLeafFlexAttrs(this, config);` in the constructor add:

```ts
      initNodeEffects(this);
```

and add two members to `Wrapped`:

```ts
    effects(): KMEffect[];
    effects(list: KMEffect[]): Wrapped;
    effects(list?: KMEffect[]): KMEffect[] | Wrapped {
      if (list === undefined) return (this.getAttr("effects") as KMEffect[] | undefined) ?? [];
      this.setAttr("effects", list); // fires effectsChange → attach/detach sync
      return this;
    }

    drawScene(...args: Parameters<Konva.Shape["drawScene"]>): this {
      if (drawNodeWithEffects(this, args[0])) return this;
      super.drawScene(...args);
      return this;
    }
```

(TS: overloaded method implementations inside a mixin class body are legal; if the
overload syntax fights the anonymous class, collapse to the single signature
`effects(list?: KMEffect[]): KMEffect[] | this`.)

Do **not** strip `effects` in `pickLeafConfig` — Konva stores unknown config keys as attrs, which is exactly where `initNodeEffects` reads them.

- [ ] **Step 2: Build + lint**

Run: `pnpm --filter @smoove/core build && pnpm check`
Expected: clean.

---

### Task 4: `effects` on Group-based nodes (Image, Text, Flex, Block)

**Files:**
- Modify: `packages/core/src/layout/image.ts`
- Modify: `packages/core/src/layout/text/text.ts` (locate the `Text extends Konva.Group` class — the constructor ends after its attr setup)
- Modify: `packages/core/src/layout/flex/flex.ts` (class `Flex`)
- Modify: `packages/core/src/layout/block.ts` (class `Block`)

- [ ] **Step 1: Apply the identical pattern to each of the four classes**

For **each** class, add the imports:

```ts
import { drawNodeWithEffects, initNodeEffects } from "../effects/apply.js"; // path depth varies: "../../effects/apply.js" from flex/ and text/
import type { KMEffect } from "../effects/contract.js";
```

Add `effects?: KMEffect[]` to the class's config type (e.g. in `image.ts`):

```ts
export type ImageConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexChildProps & {
    // ...existing fields unchanged...
    effects?: KMEffect[];
  };
```

At the **end of each constructor**, add:

```ts
    initNodeEffects(this);
```

And add to each class body (identical in all four — Konva passes `effects` through `pickKonvaConfig`'s spread since it's not in the strip list; verify it is NOT stripped):

```ts
  effects(): KMEffect[];
  effects(list: KMEffect[]): this;
  effects(list?: KMEffect[]): KMEffect[] | this {
    if (list === undefined) return (this.getAttr("effects") as KMEffect[] | undefined) ?? [];
    this.setAttr("effects", list);
    return this;
  }

  drawScene(...args: Parameters<Konva.Group["drawScene"]>): this {
    if (drawNodeWithEffects(this, args[0])) return this;
    super.drawScene(...args);
    return this;
  }
```

- [ ] **Step 2: Build + lint**

Run: `pnpm --filter @smoove/core build && pnpm check`
Expected: clean.

---

### Task 5: `effects` on Sequence (layer-wide post-pass)

**Files:**
- Modify: `packages/core/src/engine/sequence.ts`

- [ ] **Step 1: Extend options + post-pass**

Imports:

```ts
import { applyLayerEffects, initNodeEffects } from "../effects/apply.js";
import type { KMEffect } from "../effects/contract.js";
```

Extend `SequenceOptions`:

```ts
export type SequenceOptions = Konva.LayerConfig & {
  from?: number;
  durationInFrames?: number;
  /** Layer-wide shader effects applied after children draw (e.g. film grain over a scene). */
  effects?: KMEffect[];
};
```

In the constructor, `effects` rides through `layerOpts` into attrs automatically (do not add it to the destructuring). After `this._durationInFrames = durationInFrames;` add:

```ts
    initNodeEffects(this);
```

Add to the class body:

```ts
  drawScene(...args: Parameters<Konva.Layer["drawScene"]>): this {
    super.drawScene(...args);
    // biome-ignore lint/suspicious/noExplicitAny: structural canvas view for the post-pass helper.
    applyLayerEffects(this, args[0] as any);
    return this;
  }
```

Note: this also runs when transitions capture the sequence via `toCanvas` — an effected scene correctly shows its effects inside a transition.

- [ ] **Step 2: Build, lint, and smoke the demo untouched**

Run: `pnpm build && pnpm check`
Expected: all packages build; existing demo compositions unaffected (no `effects` anywhere yet → every new branch is the fast path).

---

## Phase B — @smoove/effects package + GL runtime

### Task 6: Scaffold `@smoove/effects` with Vitest

**Files:**
- Create: `packages/effects/package.json`
- Create: `packages/effects/tsconfig.json`
- Create: `packages/effects/vitest.config.ts`
- Create: `packages/effects/src/index.ts` (empty barrel for now: `export {};`)
- Modify: root `tsconfig.json` (add reference)

- [ ] **Step 1: package.json**

```json
{
  "name": "@smoove/effects",
  "version": "0.1.6",
  "description": "Hardware-accelerated shader effects and generative shader sources for smoove.",
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
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "NOTICE"],
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "test": "vitest run",
    "clean": "rm -rf dist *.tsbuildinfo",
    "prepublishOnly": "pnpm build"
  },
  "peerDependencies": {
    "@smoove/core": "workspace:^",
    "konva": ">=10"
  },
  "devDependencies": {
    "@smoove/core": "workspace:*",
    "gl": "^8.1.6",
    "konva": "^10.3.0",
    "vitest": "^3.2.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Root tsconfig reference**

Add `{ "path": "./packages/effects" }` to the root `tsconfig.json` `references` array (keep the existing ordering style).

- [ ] **Step 5: Install + build**

Run: `pnpm install && pnpm --filter @smoove/effects build`
Expected: lockfile updates (vitest, gl); empty package builds. If `gl` fails to build natively on this machine, move it to `optionalDependencies` of devDeps' spirit — i.e. keep it in devDependencies but make the pixel tests skip when `require("gl")` throws (Task 8 already guards this).

---

### Task 7: GL plumbing — shared helpers, transpile, platforms

**Files:**
- Create: `packages/effects/src/runtime/shared.ts`
- Create: `packages/effects/src/runtime/transpile.ts`
- Create: `packages/effects/src/runtime/platform.ts`

- [ ] **Step 1: shared.ts** — compile/link/texture helpers plus the flip-aware fullscreen-quad vertex shaders. (Adapted from `packages/transitions/src/gl/shared.ts`; effects cannot depend on `@smoove/transitions`, so this is a deliberate small duplication.)

```ts
// packages/effects/src/runtime/shared.ts
export type GlContext = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * Full-screen quad. `u_flipY = 1` flips V so screen-top samples texture-top —
 * used only for the final pass into the visible framebuffer; intermediate FBO
 * passes use `u_flipY = 0` to keep source orientation (avoids odd/even
 * double-flip in ping-pong chains).
 */
export const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
uniform float u_flipY;
out vec2 v_uv;
void main() {
	float y = mix(a_pos.y * 0.5 + 0.5, 0.5 - a_pos.y * 0.5, u_flipY);
	v_uv = vec2(a_pos.x * 0.5 + 0.5, y);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const VERTEX_SHADER_100 = `attribute vec2 a_pos;
uniform float u_flipY;
varying vec2 v_uv;
void main() {
	float y = mix(a_pos.y * 0.5 + 0.5, 0.5 - a_pos.y * 0.5, u_flipY);
	v_uv = vec2(a_pos.x * 0.5 + 0.5, y);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export function compileShader(gl: GlContext, source: string, type: number): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("effects: failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`effects: failed to compile shader: ${log}`);
  }
  return shader;
}

export function createProgram(gl: GlContext, fragment: string, vertex: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("effects: failed to create WebGL program");
  const vs = compileShader(gl, vertex, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fragment, gl.FRAGMENT_SHADER);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`effects: failed to link program: ${log}`);
  }
  return program;
}

export function createTexture(gl: GlContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("effects: failed to create texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}
```

- [ ] **Step 2: transpile.ts** — copy `packages/transitions/src/gl/transpile.ts` verbatim (it is 28 lines; adjust the doc comment to say "every effect fragment is authored in" instead of "Tier B presentation"). Every effect GLSL in this plan is written inside the transpilable subset: no array constructors, no `switch`, constant loop bounds, `texture()` calls only.

- [ ] **Step 3: platform.ts** — the platform interface (structurally identical to `@smoove/transitions`' `GlPlatform`, so the renderer's existing `createNodeGlPlatform()` result satisfies it) plus the browser implementation.

```ts
// packages/effects/src/runtime/platform.ts
import type { GlContext } from "./shared.js";
import { VERTEX_SHADER } from "./shared.js";

/** Structurally identical to @smoove/transitions' GlPlatform on purpose — the renderer reuses one headless-gl platform for both. */
export interface EffectGlPlatform {
  readonly gl: GlContext;
  readonly vertexShader: string;
  prepareFragment(fragment: string): string;
  resize(width: number, height: number): void;
  uploadScene(source: CanvasImageSource, width: number, height: number): void;
  result(width: number, height: number): CanvasImageSource;
}

/** Browser WebGL2 platform drawing into an offscreen canvas; `null` when unavailable. */
export function createBrowserPlatform(): EffectGlPlatform | null {
  if (typeof document === "undefined") return null;
  let canvas: HTMLCanvasElement;
  try {
    canvas = document.createElement("canvas");
  } catch {
    return null;
  }
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true });
  if (!gl) return null;
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  return {
    gl,
    vertexShader: VERTEX_SHADER,
    prepareFragment: (fragment) => fragment,
    resize(width, height) {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    },
    uploadScene(source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    },
    result() {
      return canvas;
    },
  };
}
```

- [ ] **Step 4: Build**

Run: `pnpm --filter @smoove/effects build && pnpm check`
Expected: clean.

---

### Task 8: EffectRuntime (chain executor) — with headless-gl pixel tests

**Files:**
- Create: `packages/effects/src/runtime/runtime.ts`
- Create: `packages/effects/tests/util/test-platform.ts`
- Create: `packages/effects/tests/runtime.test.ts`

- [ ] **Step 1: Write the failing pixel test first**

```ts
// packages/effects/tests/util/test-platform.ts
// A headless-gl platform for tests: uploads raw RGBA buffers, reads results
// back as raw pixels. Returns null when the optional `gl` package is absent.
import { createRequire } from "node:module";
import type { EffectGlPlatform } from "../../src/runtime/platform.js";
import { VERTEX_SHADER_100 } from "../../src/runtime/shared.js";
import { transpileTo100 } from "../../src/runtime/transpile.js";

const require = createRequire(import.meta.url);

/** Test input/output stand-in for CanvasImageSource: raw RGBA. */
export type RawImage = { data: Uint8Array; width: number; height: number };

export function createTestPlatform(): (EffectGlPlatform & { readPixels(): Uint8Array }) | null {
  let createGl: (w: number, h: number, o?: object) => WebGLRenderingContext | null;
  try {
    createGl = require("gl");
  } catch {
    return null;
  }
  const gl = createGl(4, 4, { preserveDrawingBuffer: true, premultipliedAlpha: true });
  if (!gl) return null;
  const resizeExt = gl.getExtension("STACKGL_resize_drawingbuffer") as {
    resize(w: number, h: number): void;
  } | null;
  let bw = 4;
  let bh = 4;
  return {
    gl,
    vertexShader: VERTEX_SHADER_100,
    prepareFragment: transpileTo100,
    resize(w, h) {
      if (w === bw && h === bh) return;
      resizeExt?.resize(w, h);
      bw = w;
      bh = h;
    },
    uploadScene(source, w, h) {
      const raw = source as unknown as RawImage;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, raw.data);
    },
    result(w, h) {
      // Tests read pixels directly; return a marker object.
      return { data: this.readPixels(), width: w, height: h } as unknown as CanvasImageSource;
    },
    readPixels() {
      const px = new Uint8Array(bw * bh * 4);
      gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    },
  };
}

export function solid(r: number, g: number, b: number, a: number, w = 4, h = 4): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, a], i * 4);
  return { data, width: w, height: h };
}
```

```ts
// packages/effects/tests/runtime.test.ts
import { describe, expect, it } from "vitest";
import { EffectRuntime } from "../src/runtime/runtime.js";
import { createTestPlatform, solid } from "./util/test-platform.js";

const platform = createTestPlatform();

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
    const rt = new EffectRuntime(platform!);
    rt.applyChain(solid(255, 0, 0, 255) as unknown as CanvasImageSource, [
      { fragment: IDENTITY, uniforms: {} },
    ], 4, 4);
    const px = platform!.readPixels();
    expect([px[0], px[1], px[2], px[3]]).toEqual([255, 0, 0, 255]);
  });

  it("chains two passes through the ping-pong FBOs", () => {
    const rt = new EffectRuntime(platform!);
    rt.applyChain(solid(255, 0, 0, 255) as unknown as CanvasImageSource, [
      // c.grba swaps R↔G: (255,0,0) → (0,255,0) → (255,0,0). Two passes
      // round-trip, proving the FBO ping-pong feeds pass 2 from pass 1.
      { fragment: SWAP, uniforms: { u_swap: 1 } },
      { fragment: SWAP, uniforms: { u_swap: 1 } },
    ], 4, 4);
    const px = platform!.readPixels();
    expect([px[0], px[1], px[2], px[3]]).toEqual([255, 0, 0, 255]);
  });

  it("renderSource draws without an input texture", () => {
    const rt = new EffectRuntime(platform!);
    const FLAT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec4 u_color;
out vec4 fragColor;
void main() { fragColor = u_color; }`;
    rt.renderSource({ fragment: FLAT, uniforms: { u_color: [0, 0, 1, 1] } }, 4, 4);
    const px = platform!.readPixels();
    expect([px[0], px[1], px[2], px[3]]).toEqual([0, 0, 255, 255]);
  });

  it("returns null (not throw) on a broken fragment", () => {
    const rt = new EffectRuntime(platform!);
    const out = rt.applyChain(
      solid(0, 0, 0, 255) as unknown as CanvasImageSource,
      [{ fragment: "not glsl", uniforms: {} }],
      4,
      4,
    );
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @smoove/effects test`
Expected: FAIL — `EffectRuntime` not found (or all skipped if `gl` missing; in that case still proceed, browser/demo verification covers it).

- [ ] **Step 3: Implement the runtime**

```ts
// packages/effects/src/runtime/runtime.ts
import {
  type EffectPass,
  type KMEffectRuntime,
  setEffectRuntime,
  type UniformValue,
} from "@smoove/core";
import { createBrowserPlatform, type EffectGlPlatform } from "./platform.js";
import { createProgram, createTexture, type GlContext } from "./shared.js";

type ProgramEntry = {
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

export class EffectRuntime implements KMEffectRuntime {
  private readonly platform: EffectGlPlatform;
  private readonly gl: GlContext;
  private readonly programs = new Map<string, ProgramEntry>();
  private readonly originalTex: WebGLTexture;
  private readonly pingTex: [WebGLTexture, WebGLTexture];
  private readonly pingFbo: [WebGLFramebuffer, WebGLFramebuffer];
  private fboWidth = 0;
  private fboHeight = 0;
  private broken = new Set<string>();

  constructor(platform: EffectGlPlatform) {
    this.platform = platform;
    this.gl = platform.gl;
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.originalTex = createTexture(gl);
    this.pingTex = [createTexture(gl), createTexture(gl)];
    const f0 = gl.createFramebuffer();
    const f1 = gl.createFramebuffer();
    if (!f0 || !f1) throw new Error("effects: failed to create framebuffers");
    this.pingFbo = [f0, f1];
  }

  private entry(fragment: string): ProgramEntry | null {
    if (this.broken.has(fragment)) return null;
    let e = this.programs.get(fragment);
    if (!e) {
      try {
        const program = createProgram(
          this.gl,
          this.platform.prepareFragment(fragment),
          this.platform.vertexShader,
        );
        e = { program, locations: new Map() };
        this.programs.set(fragment, e);
      } catch (err) {
        this.broken.add(fragment);
        console.warn("[smoove/effects] shader failed to compile — effect skipped:", err);
        return null;
      }
    }
    return e;
  }

  private loc(e: ProgramEntry, name: string): WebGLUniformLocation | null {
    if (!e.locations.has(name)) {
      const direct = this.gl.getUniformLocation(e.program, name);
      e.locations.set(name, direct ?? this.gl.getUniformLocation(e.program, `${name}[0]`));
    }
    return e.locations.get(name) ?? null;
  }

  private setUniform(e: ProgramEntry, name: string, value: UniformValue): void {
    const gl = this.gl;
    const loc = this.loc(e, name);
    if (loc === null) return;
    if (typeof value === "number") gl.uniform1f(loc, value);
    else if (typeof value === "boolean") gl.uniform1f(loc, value ? 1 : 0);
    else if (Array.isArray(value[0])) {
      const vecs = value as number[][];
      const size = vecs[0]?.length ?? 4;
      const flat = new Float32Array(vecs.length * size);
      vecs.forEach((v, i) => flat.set(v, i * size));
      if (size === 2) gl.uniform2fv(loc, flat);
      else if (size === 3) gl.uniform3fv(loc, flat);
      else gl.uniform4fv(loc, flat);
    } else {
      const v = value as number[];
      if (v.length === 2) gl.uniform2f(loc, v[0] as number, v[1] as number);
      else if (v.length === 3) gl.uniform3f(loc, v[0] as number, v[1] as number, v[2] as number);
      else gl.uniform4f(loc, v[0] as number, v[1] as number, v[2] as number, v[3] as number);
    }
  }

  private ensureFboSize(width: number, height: number): void {
    if (this.fboWidth === width && this.fboHeight === height) return;
    const gl = this.gl;
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.pingTex[i] as WebGLTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingFbo[i] as WebGLFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.pingTex[i] as WebGLTexture,
        0,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fboWidth = width;
    this.fboHeight = height;
  }

  private drawPass(
    pass: EffectPass,
    readTex: WebGLTexture | null,
    toFbo: WebGLFramebuffer | null,
    width: number,
    height: number,
  ): boolean {
    const gl = this.gl;
    const e = this.entry(pass.fragment);
    if (!e) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, toFbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(e.program);
    const aPos = gl.getAttribLocation(e.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    if (readTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTex);
      const t = this.loc(e, "u_texture");
      if (t) gl.uniform1i(t, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.originalTex);
      const o = this.loc(e, "u_original");
      if (o) gl.uniform1i(o, 1);
    }
    this.setUniform(e, "u_resolution", [width, height]);
    // Flip only when rendering to the visible framebuffer (see shared.ts).
    this.setUniform(e, "u_flipY", toFbo === null ? 1 : 0);
    for (const [name, value] of Object.entries(pass.uniforms)) this.setUniform(e, name, value);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  applyChain(
    input: CanvasImageSource,
    passes: EffectPass[],
    width: number,
    height: number,
  ): CanvasImageSource | null {
    if (passes.length === 0) return null;
    const gl = this.gl;
    this.platform.resize(width, height);
    this.ensureFboSize(width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.originalTex);
    this.platform.uploadScene(input, width, height);

    let readTex: WebGLTexture = this.originalTex;
    for (let i = 0; i < passes.length; i++) {
      const last = i === passes.length - 1;
      const fbo = last ? null : (this.pingFbo[i % 2] as WebGLFramebuffer);
      const pass = passes[i] as EffectPass;
      if (!this.drawPass(pass, readTex, fbo, width, height)) return null;
      if (!last) readTex = this.pingTex[i % 2] as WebGLTexture;
    }
    return this.platform.result(width, height);
  }

  renderSource(pass: EffectPass, width: number, height: number): CanvasImageSource | null {
    this.platform.resize(width, height);
    if (!this.drawPass(pass, null, null, width, height)) return null;
    return this.platform.result(width, height);
  }

  dispose(): void {
    const gl = this.gl;
    for (const e of this.programs.values()) gl.deleteProgram(e.program);
    this.programs.clear();
    gl.deleteTexture(this.originalTex);
    gl.deleteTexture(this.pingTex[0] as WebGLTexture);
    gl.deleteTexture(this.pingTex[1] as WebGLTexture);
    gl.deleteFramebuffer(this.pingFbo[0] as WebGLFramebuffer);
    gl.deleteFramebuffer(this.pingFbo[1] as WebGLFramebuffer);
    setEffectRuntime(null);
  }
}

let platformFactory: (() => EffectGlPlatform | null) | null = null;
let installed: EffectRuntime | null | undefined;

/**
 * Override how the shared runtime's GL platform is created — used by server
 * renderers to inject a headless-gl backend (mirrors transitions'
 * `setCompositorFactory`). Clears the memoized runtime.
 */
export function setEffectPlatformFactory(create: (() => EffectGlPlatform | null) | null): void {
  platformFactory = create;
  installed = undefined;
}

/** Lazily build the shared runtime and register it with @smoove/core. Called by every Effect/ShaderSource constructor. */
export function ensureEffectRuntime(): void {
  if (installed !== undefined) return;
  const platform = platformFactory ? platformFactory() : createBrowserPlatform();
  installed = platform ? new EffectRuntime(platform) : null;
  if (installed) setEffectRuntime(installed);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @smoove/effects test`
Expected: PASS (or SKIP when `gl` is unavailable). Also `pnpm --filter @smoove/effects build && pnpm check`.

---

## Phase C — Effect base class

### Task 9: Param schemas, accessors, color conversion, Effect base (TDD)

**Files:**
- Create: `packages/effects/src/params.ts`
- Create: `packages/effects/src/effect.ts`
- Create: `packages/effects/tests/params.test.ts`
- Create: `packages/effects/tests/effect.test.ts`
- Modify: `packages/effects/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/effects/tests/params.test.ts
import { describe, expect, it } from "vitest";
import { defaultsFromSchema, paramsToUniforms, parseColorVec4, type ParamSchema } from "../src/params.js";

const CTX = { frame: 30, time: 1, fps: 30, width: 100, height: 50, pixelRatio: 1 };

describe("parseColorVec4", () => {
  it("parses hex", () => {
    expect(parseColorVec4("#ff0000")).toEqual([1, 0, 0, 1]);
    expect(parseColorVec4("#0f0")).toEqual([0, 1, 0, 1]);
    expect(parseColorVec4("#0000ff80")[3]).toBeCloseTo(0.5, 1);
  });
  it("parses rgb()/rgba()", () => {
    expect(parseColorVec4("rgb(255, 0, 0)")).toEqual([1, 0, 0, 1]);
    expect(parseColorVec4("rgba(0, 255, 0, 0.5)")).toEqual([0, 1, 0, 0.5]);
  });
});

describe("paramsToUniforms", () => {
  const schema: ParamSchema = {
    radius: { type: "number", uniform: "u_radius", default: 10, min: 0, max: 100 },
    color: { type: "color", uniform: "u_color", default: "#ffffff" },
    colors: { type: "colors", uniform: "u_colors", default: ["#000", "#fff"], max: 8 },
    angle: { type: "number", uniform: "u_angle", default: 0, unit: "deg" },
    speed: { type: "number", uniform: null, default: 2 },
  };
  it("maps values, converts colors/degrees, injects u_time from speed", () => {
    const u = paramsToUniforms(schema, defaultsFromSchema(schema), CTX);
    expect(u.u_radius).toBe(10);
    expect(u.u_color).toEqual([1, 1, 1, 1]);
    expect(u.u_colors).toEqual([[0, 0, 0, 1], [1, 1, 1, 1]]);
    expect(u.u_colorsCount).toBe(2);
    expect(u.u_angle).toBe(0);
    expect(u.u_time).toBe(2); // time(1s) * speed(2)
    expect("u_speed" in u).toBe(false); // uniform: null params don't emit
  });
  it("converts degrees to radians", () => {
    const u = paramsToUniforms(schema, { ...defaultsFromSchema(schema), angle: 180 }, CTX);
    expect(u.u_angle).toBeCloseTo(Math.PI);
  });
});
```

```ts
// packages/effects/tests/effect.test.ts
import { describe, expect, it } from "vitest";
import { Effect } from "../src/effect.js";
import type { ParamSchema } from "../src/params.js";

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 5, min: 0, max: 10 },
};
const FRAG = "void main() {}";

class TestEffect extends Effect {
  constructor(config: { amount?: number; enabled?: boolean } = {}) {
    super(SCHEMA, FRAG, config);
  }
}
interface TestEffect {
  amount(): number;
  amount(v: number): this;
}

const CTX = { frame: 0, time: 0, fps: 30, width: 10, height: 10, pixelRatio: 1 };

describe("Effect", () => {
  it("generates getter/setter accessors from the schema", () => {
    const e = new TestEffect();
    expect(e.amount()).toBe(5);
    expect(e.amount(7)).toBe(e); // setter chains
    expect(e.amount()).toBe(7);
  });
  it("takes constructor config", () => {
    expect(new TestEffect({ amount: 2 }).amount()).toBe(2);
  });
  it("enable()/enabled() and pass emission", () => {
    const e = new TestEffect();
    expect(e.enabled()).toBe(true);
    e.enable(false);
    expect(e.enabled()).toBe(false);
    const passes = e._kmPasses(CTX);
    expect(passes).toHaveLength(1);
    expect(passes[0]!.fragment).toBe(FRAG);
    expect(passes[0]!.uniforms.u_amount).toBe(5);
  });
  it("redraws attached nodes' layers on param change", () => {
    const e = new TestEffect();
    let drawn = 0;
    const fakeLayer = { batchDraw: () => drawn++ };
    const fakeNode = { getLayer: () => fakeLayer } as never;
    e._kmAttach(fakeNode);
    e.amount(9);
    e.enable(false);
    expect(drawn).toBe(2);
    e._kmDetach(fakeNode);
    e.amount(3);
    expect(drawn).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL** (`../src/params.js` not found).

- [ ] **Step 3: Implement params.ts**

```ts
// packages/effects/src/params.ts
import type { EffectFrameContext, EffectUniforms, UniformValue } from "@smoove/core";

export type ParamType = "number" | "boolean" | "color" | "colors" | "vec2" | "enum";

export type ParamSpec = {
  type: ParamType;
  /** GLSL uniform name, or `null` for params consumed in TS (e.g. `speed`). */
  uniform: string | null;
  default: unknown;
  min?: number;
  max?: number; // for "colors": max stop count (GLSL array size)
  step?: number;
  /** "deg" numbers are converted to radians at uniform time. */
  unit?: "deg";
  /** enum only: ordered labels; uniform value is the index as float. */
  values?: string[];
};

/** Schema drives accessor generation now and the Studio props panel later. */
export type ParamSchema = Record<string, ParamSpec>;

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  transparent: "#00000000",
};

/** Parse `#rgb/#rrggbb/#rrggbbaa/rgb()/rgba()` (+ a few names) to a 0..1 vec4. */
export function parseColorVec4(input: string): number[] {
  let c = input.trim().toLowerCase();
  c = NAMED[c] ?? c;
  const fn = c.match(/^rgba?\(([^)]+)\)$/);
  if (fn?.[1]) {
    const parts = fn[1].split(",").map((p) => Number.parseFloat(p));
    return [
      (parts[0] ?? 0) / 255,
      (parts[1] ?? 0) / 255,
      (parts[2] ?? 0) / 255,
      parts.length > 3 ? (parts[3] ?? 1) : 1,
    ];
  }
  let hex = c.startsWith("#") ? c.slice(1) : c;
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((ch) => ch + ch).join("");
  }
  const n = Number.parseInt(hex.padEnd(8, "f"), 16);
  return [((n >>> 24) & 0xff) / 255, ((n >>> 16) & 0xff) / 255, ((n >>> 8) & 0xff) / 255, (n & 0xff) / 255];
}

export function defaultsFromSchema(schema: ParamSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema)) out[key] = spec.default;
  return out;
}

export function pickSchemaConfig(
  schema: ParamSchema,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    if (config[key] !== undefined) out[key] = config[key];
  }
  return out;
}

/**
 * Map param values → GLSL uniforms per the schema, plus the shared `u_time`
 * (composition seconds × `speed` param when present — deterministic).
 */
export function paramsToUniforms(
  schema: ParamSchema,
  values: Record<string, unknown>,
  ctx: EffectFrameContext,
): EffectUniforms {
  const out: EffectUniforms = {};
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.uniform === null) continue;
    const v = values[key];
    let mapped: UniformValue;
    switch (spec.type) {
      case "number":
        mapped = spec.unit === "deg" ? ((v as number) * Math.PI) / 180 : (v as number);
        break;
      case "boolean":
        mapped = v as boolean;
        break;
      case "color":
        mapped = parseColorVec4(v as string);
        break;
      case "colors": {
        const list = (v as string[]).slice(0, spec.max ?? 8).map(parseColorVec4);
        out[`${spec.uniform}Count`] = list.length;
        mapped = list;
        break;
      }
      case "vec2":
        mapped = v as number[];
        break;
      case "enum":
        mapped = Math.max(0, (spec.values ?? []).indexOf(v as string));
        break;
    }
    out[spec.uniform] = mapped;
  }
  const speed = typeof values.speed === "number" ? values.speed : 1;
  out.u_time = ctx.time * speed;
  return out;
}

/** Define a Konva-Factory-style `key(v?)` accessor per schema param. */
export function buildAccessors(
  target: { _kmParamGet(key: string): unknown; _kmParamSet(key: string, v: unknown): unknown },
  schema: ParamSchema,
): void {
  for (const key of Object.keys(schema)) {
    Object.defineProperty(target, key, {
      value: function (this: typeof target, v?: unknown) {
        if (v === undefined) return this._kmParamGet(key);
        return this._kmParamSet(key, v);
      },
      writable: true,
      configurable: true,
    });
  }
}
```

- [ ] **Step 4: Implement effect.ts**

```ts
// packages/effects/src/effect.ts
import type Konva from "konva";
import type { EffectFrameContext, EffectPass, KMEffect } from "@smoove/core";
import {
  buildAccessors,
  defaultsFromSchema,
  type ParamSchema,
  paramsToUniforms,
  pickSchemaConfig,
} from "./params.js";
import { ensureEffectRuntime } from "./runtime/runtime.js";

export type EffectConfig = { enabled?: boolean } & Record<string, unknown>;

/**
 * Base class for all shader filter effects. Subclasses supply a param schema
 * and a fragment shader; accessors (`blur.radius(8)`) are generated from the
 * schema. Instances are plain objects, shareable across nodes.
 */
export abstract class Effect implements KMEffect {
  readonly _kmEffect = true as const;
  /** Exposed for the Studio props panel. */
  readonly schema: ParamSchema;
  protected readonly _values: Record<string, unknown>;
  private readonly _fragment: string;
  private _enabled: boolean;
  private readonly _nodes = new Set<Konva.Node>();

  protected constructor(schema: ParamSchema, fragment: string, config: EffectConfig = {}) {
    ensureEffectRuntime();
    this.schema = schema;
    this._fragment = fragment;
    this._values = { ...defaultsFromSchema(schema), ...pickSchemaConfig(schema, config) };
    this._enabled = config.enabled ?? true;
    buildAccessors(this, schema);
  }

  enable(on = true): this {
    if (on !== this._enabled) {
      this._enabled = on;
      this._redraw();
    }
    return this;
  }

  enabled(): boolean {
    return this._enabled;
  }

  /** Bulk param update: `e.set({ radius: 4, color: "#f00" })`. Unknown keys ignored. */
  set(values: Record<string, unknown>): this {
    let changed = false;
    for (const [key, v] of Object.entries(pickSchemaConfig(this.schema, values))) {
      if (this._values[key] !== v) {
        this._values[key] = v;
        changed = true;
      }
    }
    if (changed) this._redraw();
    return this;
  }

  /** @internal accessor plumbing (see buildAccessors). */
  _kmParamGet(key: string): unknown {
    return this._values[key];
  }

  /** @internal */
  _kmParamSet(key: string, v: unknown): this {
    if (this._values[key] !== v) {
      this._values[key] = v;
      this._redraw();
    }
    return this;
  }

  private _redraw(): void {
    for (const node of this._nodes) node.getLayer()?.batchDraw();
  }

  _kmAttach(node: Konva.Node): void {
    this._nodes.add(node);
  }

  _kmDetach(node: Konva.Node): void {
    this._nodes.delete(node);
  }

  _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    return [{ fragment: this._fragment, uniforms: paramsToUniforms(this.schema, this._values, ctx) }];
  }
}
```

- [ ] **Step 5: Barrel** — replace `src/index.ts` content:

```ts
export { Effect, type EffectConfig } from "./effect.js";
export { type ParamSchema, type ParamSpec, type ParamType, parseColorVec4 } from "./params.js";
export type { EffectGlPlatform } from "./runtime/platform.js";
export { EffectRuntime, ensureEffectRuntime, setEffectPlatformFactory } from "./runtime/runtime.js";
```

- [ ] **Step 6: Run tests — expect PASS.** Then `pnpm --filter @smoove/effects build && pnpm check`.

---

## Phase D — filter catalog

Every filter follows the same file shape: one `src/filters/<name>.ts` exporting the config type, the class (with a declaration-merged interface for accessor types), and its GLSL. GLSL rules (so `transpileTo100` works): `#version 300 es`, `precision highp float;`, `in vec2 v_uv;`, `out vec4 fragColor;`, only `texture()` sampling, no array constructors, no `switch`, constant loop bounds. Textures arrive **premultiplied** — treat `rgb` as premultiplied by `a` (multiply new color contributions by alpha).

Each task ends with: add exports to `src/index.ts`, `pnpm --filter @smoove/effects test && pnpm --filter @smoove/effects build && pnpm check`.

### Task 10: BlurEffect (two-pass gaussian)

**Files:**
- Create: `packages/effects/src/filters/blur.ts`
- Create: `packages/effects/tests/filters.test.ts` (shared by Tasks 10–14; grows per task)

- [ ] **Step 1: Failing test** (in `tests/filters.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { BlurEffect } from "../src/filters/blur.js";

const CTX = { frame: 0, time: 0, fps: 30, width: 100, height: 100, pixelRatio: 1 };

describe("BlurEffect", () => {
  it("emits two directional passes scaled by radius", () => {
    const e = new BlurEffect({ radius: 8 });
    const passes = e._kmPasses(CTX);
    expect(passes).toHaveLength(2);
    expect(passes[0]!.uniforms.u_direction).toEqual([8, 0]);
    expect(passes[1]!.uniforms.u_direction).toEqual([0, 8]);
  });
  it("honors horizontal/vertical toggles", () => {
    expect(new BlurEffect({ radius: 4, vertical: false })._kmPasses(CTX)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
// packages/effects/src/filters/blur.ts
import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction; // (radius, 0) or (0, radius) in px
out vec4 fragColor;
void main() {
	vec2 step = u_direction / u_resolution;
	vec4 acc = vec4(0.0);
	float total = 0.0;
	for (int i = -7; i <= 7; i++) {
		float t = float(i) / 7.0;
		float w = exp(-t * t * 3.0);
		acc += texture(u_texture, v_uv + step * t) * w;
		total += w;
	}
	fragColor = acc / total;
}`;

const SCHEMA: ParamSchema = {
  radius: { type: "number", uniform: null, default: 10, min: 0, max: 100, step: 1 },
  horizontal: { type: "boolean", uniform: null, default: true },
  vertical: { type: "boolean", uniform: null, default: true },
};

export type BlurConfig = EffectConfig & {
  radius?: number;
  horizontal?: boolean;
  vertical?: boolean;
};

export class BlurEffect extends Effect {
  constructor(config: BlurConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const base = paramsToUniforms(this.schema, this._values, ctx);
    const r = this._values.radius as number;
    const passes: EffectPass[] = [];
    if (r <= 0) return passes;
    if (this._values.horizontal) {
      passes.push({ fragment: FRAGMENT, uniforms: { ...base, u_direction: [r, 0] } });
    }
    if (this._values.vertical) {
      passes.push({ fragment: FRAGMENT, uniforms: { ...base, u_direction: [0, r] } });
    }
    return passes;
  }
}

export interface BlurEffect {
  radius(): number;
  radius(v: number): this;
  horizontal(): boolean;
  horizontal(v: boolean): this;
  vertical(): boolean;
  vertical(v: boolean): this;
}
```

- [ ] **Step 4: Run — PASS.** Export `BlurEffect, type BlurConfig` from `src/index.ts`.

### Task 11: ColorKeyEffect (chroma key)

**Files:**
- Create: `packages/effects/src/filters/color-key.ts`
- Modify: `packages/effects/tests/filters.test.ts`
- Modify: `packages/effects/tests/runtime.test.ts` — add one end-to-end pixel test

- [ ] **Step 1: Failing tests**

```ts
// append to tests/filters.test.ts
import { ColorKeyEffect } from "../src/filters/color-key.js";

describe("ColorKeyEffect", () => {
  it("maps color + thresholds to uniforms", () => {
    const e = new ColorKeyEffect({ color: "#00ff00", similarity: 0.4, smoothness: 0.1 });
    const u = e._kmPasses(CTX)[0]!.uniforms;
    expect(u.u_keyColor).toEqual([0, 1, 0, 1]);
    expect(u.u_similarity).toBe(0.4);
    expect(u.u_smoothness).toBe(0.1);
  });
});
```

```ts
// append to tests/runtime.test.ts (inside describe.skipIf(!platform))
  it("colorKey keys out a green input", async () => {
    const { ColorKeyEffect } = await import("../src/filters/color-key.js");
    const rt = new EffectRuntime(platform!);
    const e = new ColorKeyEffect({ color: "#00ff00" });
    const ctx = { frame: 0, time: 0, fps: 30, width: 4, height: 4, pixelRatio: 1 };
    rt.applyChain(solid(0, 255, 0, 255) as unknown as CanvasImageSource, e._kmPasses(ctx), 4, 4);
    const px = platform!.readPixels();
    expect(px[3]).toBe(0); // fully transparent
  });
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** (OBS-style YUV chroma distance — public-domain technique)

```ts
// packages/effects/src/filters/color-key.ts
import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec4 u_keyColor;
uniform float u_similarity; // 0..1 chroma distance below which pixels are removed
uniform float u_smoothness; // 0..1 soft edge width
uniform float u_spill;      // 0..1 spill-suppression width
out vec4 fragColor;

vec2 rgb2uv(vec3 rgb) {
	return vec2(
		rgb.r * -0.169 + rgb.g * -0.331 + rgb.b * 0.5 + 0.5,
		rgb.r * 0.5 + rgb.g * -0.419 + rgb.b * -0.081 + 0.5
	);
}

void main() {
	vec4 c = texture(u_texture, v_uv);
	vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0); // un-premultiply for keying math
	float dist = distance(rgb2uv(rgb), rgb2uv(u_keyColor.rgb));
	float base = dist - u_similarity;
	float mask = pow(clamp(base / max(u_smoothness, 0.0001), 0.0, 1.0), 1.5);
	float spill = pow(clamp(base / max(u_spill, 0.0001), 0.0, 1.0), 1.5);
	float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb = mix(vec3(gray), rgb, spill);
	float a = c.a * mask;
	fragColor = vec4(rgb * a, a); // re-premultiply
}`;

const SCHEMA: ParamSchema = {
  color: { type: "color", uniform: "u_keyColor", default: "#00ff00" },
  similarity: { type: "number", uniform: "u_similarity", default: 0.35, min: 0, max: 1, step: 0.01 },
  smoothness: { type: "number", uniform: "u_smoothness", default: 0.08, min: 0, max: 1, step: 0.01 },
  spill: { type: "number", uniform: "u_spill", default: 0.1, min: 0, max: 1, step: 0.01 },
};

export type ColorKeyConfig = EffectConfig & {
  color?: string;
  similarity?: number;
  smoothness?: number;
  spill?: number;
};

export class ColorKeyEffect extends Effect {
  constructor(config: ColorKeyConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface ColorKeyEffect {
  color(): string;
  color(v: string): this;
  similarity(): number;
  similarity(v: number): this;
  smoothness(): number;
  smoothness(v: number): this;
  spill(): number;
  spill(v: number): this;
}
```

- [ ] **Step 4: Run — PASS.** Export from barrel.

### Task 12: PixelateEffect + VignetteEffect

**Files:**
- Create: `packages/effects/src/filters/pixelate.ts`
- Create: `packages/effects/src/filters/vignette.ts`
- Modify: `packages/effects/tests/filters.test.ts`

- [ ] **Step 1: Failing uniform tests** — append to `tests/filters.test.ts`:

```ts
import { PixelateEffect } from "../src/filters/pixelate.js";
import { VignetteEffect } from "../src/filters/vignette.js";

describe("PixelateEffect", () => {
  it("maps size to u_size", () => {
    expect(new PixelateEffect({ size: 12 })._kmPasses(CTX)[0]!.uniforms.u_size).toBe(12);
  });
});

describe("VignetteEffect", () => {
  it("maps params to uniforms", () => {
    const u = new VignetteEffect({ amount: 0.5, radius: 0.8, softness: 0.2, color: "#ff0000" })
      ._kmPasses(CTX)[0]!.uniforms;
    expect(u.u_amount).toBe(0.5);
    expect(u.u_radius).toBe(0.8);
    expect(u.u_softness).toBe(0.2);
    expect(u.u_color).toEqual([1, 0, 0, 1]);
  });
});
```

Run: `pnpm --filter @smoove/effects test` — expect FAIL (modules not found).

- [ ] **Step 2: Implement pixelate.ts**

```ts
// packages/effects/src/filters/pixelate.ts
import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_size; // cell size in px
out vec4 fragColor;
void main() {
	vec2 cell = max(u_size, 1.0) / u_resolution;
	vec2 uv = (floor(v_uv / cell) + 0.5) * cell;
	fragColor = texture(u_texture, uv);
}`;

const SCHEMA: ParamSchema = {
  size: { type: "number", uniform: "u_size", default: 8, min: 1, max: 200, step: 1 },
};

export type PixelateConfig = EffectConfig & { size?: number };

export class PixelateEffect extends Effect {
  constructor(config: PixelateConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface PixelateEffect {
  size(): number;
  size(v: number): this;
}
```

- [ ] **Step 3: Implement vignette.ts**

```ts
// packages/effects/src/filters/vignette.ts
import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;   // 0..1 strength
uniform float u_radius;   // 0..1 where falloff starts (center-relative)
uniform float u_softness; // falloff width
uniform vec4 u_color;     // vignette color
out vec4 fragColor;
void main() {
	vec4 c = texture(u_texture, v_uv);
	vec2 p = v_uv - 0.5;
	p.x *= u_resolution.x / u_resolution.y;
	float v = smoothstep(u_radius, u_radius - max(u_softness, 0.0001), length(p));
	float k = mix(1.0, v, u_amount);
	fragColor = vec4(mix(u_color.rgb * c.a, c.rgb, k), c.a);
}`;

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 0.6, min: 0, max: 1, step: 0.01 },
  radius: { type: "number", uniform: "u_radius", default: 0.7, min: 0, max: 1.5, step: 0.01 },
  softness: { type: "number", uniform: "u_softness", default: 0.45, min: 0.01, max: 1, step: 0.01 },
  color: { type: "color", uniform: "u_color", default: "#000000" },
};

export type VignetteConfig = EffectConfig & {
  amount?: number;
  radius?: number;
  softness?: number;
  color?: string;
};

export class VignetteEffect extends Effect {
  constructor(config: VignetteConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface VignetteEffect {
  amount(): number;
  amount(v: number): this;
  radius(): number;
  radius(v: number): this;
  softness(): number;
  softness(v: number): this;
  color(): string;
  color(v: string): this;
}
```

- [ ] **Step 4: Run — PASS.** Export both from barrel.

### Task 13: ChromaticAberrationEffect + NoiseGrainEffect

**Files:**
- Create: `packages/effects/src/filters/chromatic-aberration.ts`
- Create: `packages/effects/src/filters/noise-grain.ts`
- Modify: `packages/effects/tests/filters.test.ts`

- [ ] **Step 1: Failing uniform tests** — append to `tests/filters.test.ts`:

```ts
import { ChromaticAberrationEffect } from "../src/filters/chromatic-aberration.js";
import { NoiseGrainEffect } from "../src/filters/noise-grain.js";

describe("ChromaticAberrationEffect", () => {
  it("maps amount and converts angle to radians", () => {
    const u = new ChromaticAberrationEffect({ amount: 6, angle: 90 })._kmPasses(CTX)[0]!.uniforms;
    expect(u.u_amount).toBe(6);
    expect(u.u_angle).toBeCloseTo(Math.PI / 2);
  });
});

describe("NoiseGrainEffect", () => {
  it("seeds from the frame when animated, pins to 0 when not", () => {
    const at = (frame: number, animated: boolean) =>
      new NoiseGrainEffect({ animated })._kmPasses({ ...CTX, frame })[0]!.uniforms.u_seed;
    expect(at(7, true)).toBe(7);
    expect(at(8, true)).toBe(8);
    expect(at(7, false)).toBe(0);
    expect(at(8, false)).toBe(0);
  });
});
```

Run: `pnpm --filter @smoove/effects test` — expect FAIL (modules not found).

- [ ] **Step 2: Implement chromatic-aberration.ts**

```ts
// packages/effects/src/filters/chromatic-aberration.ts
import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount; // px offset
uniform float u_angle;  // radians
out vec4 fragColor;
void main() {
	vec2 off = vec2(cos(u_angle), sin(u_angle)) * u_amount / u_resolution;
	vec4 g = texture(u_texture, v_uv);
	float r = texture(u_texture, v_uv + off).r;
	float b = texture(u_texture, v_uv - off).b;
	fragColor = vec4(r, g.g, b, g.a);
}`;

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 4, min: 0, max: 60, step: 0.5 },
  angle: { type: "number", uniform: "u_angle", default: 0, min: 0, max: 360, step: 1, unit: "deg" },
};

export type ChromaticAberrationConfig = EffectConfig & { amount?: number; angle?: number };

export class ChromaticAberrationEffect extends Effect {
  constructor(config: ChromaticAberrationConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface ChromaticAberrationEffect {
  amount(): number;
  amount(v: number): this;
  angle(): number;
  angle(v: number): this;
}
```

- [ ] **Step 3: Implement noise-grain.ts** (frame-seeded hash noise; deterministic per frame)

```ts
// packages/effects/src/filters/noise-grain.ts
import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount; // 0..1
uniform float u_size;   // grain cell px
uniform float u_seed;
out vec4 fragColor;
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
	vec4 c = texture(u_texture, v_uv);
	vec2 cell = floor(v_uv * u_resolution / max(u_size, 1.0));
	float n = hash(cell + vec2(u_seed * 0.613, u_seed * 0.377)) - 0.5;
	fragColor = vec4(c.rgb + n * u_amount * c.a, c.a);
}`;

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 0.25, min: 0, max: 1, step: 0.01 },
  size: { type: "number", uniform: "u_size", default: 1, min: 1, max: 16, step: 1 },
  animated: { type: "boolean", uniform: null, default: true },
};

export type NoiseGrainConfig = EffectConfig & { amount?: number; size?: number; animated?: boolean };

export class NoiseGrainEffect extends Effect {
  constructor(config: NoiseGrainConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const uniforms = paramsToUniforms(this.schema, this._values, ctx);
    uniforms.u_seed = this._values.animated ? ctx.frame : 0;
    return [{ fragment: FRAGMENT, uniforms }];
  }
}

export interface NoiseGrainEffect {
  amount(): number;
  amount(v: number): this;
  size(): number;
  size(v: number): this;
  animated(): boolean;
  animated(v: boolean): this;
}
```

- [ ] **Step 4: Run — PASS.** Export both from barrel.

### Task 14: GlowEffect (3 passes, uses `u_original`) + HeatmapEffect

**Files:**
- Create: `packages/effects/src/filters/glow.ts`
- Create: `packages/effects/src/filters/heatmap.ts`
- Modify: `packages/effects/tests/filters.test.ts`

- [ ] **Step 1: Failing tests** — append to `tests/filters.test.ts`:

```ts
import { GlowEffect } from "../src/filters/glow.js";
import { HeatmapEffect } from "../src/filters/heatmap.js";

describe("GlowEffect", () => {
  it("emits blur-H, blur-V, then a composite pass", () => {
    const passes = new GlowEffect({ radius: 10 })._kmPasses(CTX);
    expect(passes).toHaveLength(3);
    expect(passes[0]!.uniforms.u_direction).toEqual([10, 0]);
    expect(passes[1]!.uniforms.u_direction).toEqual([0, 10]);
    expect(passes[1]!.uniforms.u_threshold).toBe(0); // brightpass only on pass 1
    expect(passes[2]!.fragment).toContain("u_original");
  });
});

describe("HeatmapEffect", () => {
  it("maps the color ramp and shape params", () => {
    const u = new HeatmapEffect({ colors: ["#000", "#fff"], contour: 12, angle: 90, offset: 0.25 })
      ._kmPasses(CTX)[0]!.uniforms;
    expect(u.u_colors).toEqual([[0, 0, 0, 1], [1, 1, 1, 1]]);
    expect(u.u_colorsCount).toBe(2);
    expect(u.u_contour).toBe(12);
    expect(u.u_angle).toBeCloseTo(Math.PI / 2);
    expect(u.u_offset).toBe(0.25);
  });
});
```

Run: `pnpm --filter @smoove/effects test` — expect FAIL (modules not found).

- [ ] **Step 2: Implement glow.ts**

```ts
// packages/effects/src/filters/glow.ts
import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";

// Pass 1: horizontal blur of the bright/alpha regions.
const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction;
uniform float u_threshold; // only on pass 1 (0 on pass 2)
out vec4 fragColor;
void main() {
	vec2 step = u_direction / u_resolution;
	vec4 acc = vec4(0.0);
	float total = 0.0;
	for (int i = -7; i <= 7; i++) {
		float t = float(i) / 7.0;
		float w = exp(-t * t * 3.0);
		vec4 s = texture(u_texture, v_uv + step * t);
		float lum = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
		s *= smoothstep(u_threshold, u_threshold + 0.1, max(lum, s.a));
		acc += s * w;
		total += w;
	}
	fragColor = acc / total;
}`;

// Pass 3: additive composite of the blurred halo over the original.
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;  // blurred halo
uniform sampler2D u_original; // untouched input
uniform vec4 u_color;
uniform float u_intensity;
out vec4 fragColor;
void main() {
	vec4 o = texture(u_original, v_uv);
	vec4 b = texture(u_texture, v_uv);
	vec3 halo = u_color.rgb * b.a * u_intensity;
	float a = clamp(o.a + b.a * u_intensity * u_color.a, 0.0, 1.0);
	fragColor = vec4(o.rgb + halo * (1.0 - o.a), a);
}`;

const SCHEMA: ParamSchema = {
  radius: { type: "number", uniform: null, default: 16, min: 0, max: 100, step: 1 },
  intensity: { type: "number", uniform: "u_intensity", default: 0.8, min: 0, max: 3, step: 0.05 },
  color: { type: "color", uniform: "u_color", default: "#ffffff" },
  threshold: { type: "number", uniform: "u_threshold", default: 0, min: 0, max: 1, step: 0.01 },
};

export type GlowConfig = EffectConfig & {
  radius?: number;
  intensity?: number;
  color?: string;
  threshold?: number;
};

export class GlowEffect extends Effect {
  constructor(config: GlowConfig = {}) {
    super(SCHEMA, COMPOSITE_FRAG, config);
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const base = paramsToUniforms(this.schema, this._values, ctx);
    const r = this._values.radius as number;
    return [
      { fragment: BLUR_FRAG, uniforms: { ...base, u_direction: [r, 0] } },
      { fragment: BLUR_FRAG, uniforms: { ...base, u_direction: [0, r], u_threshold: 0 } },
      { fragment: COMPOSITE_FRAG, uniforms: base },
    ];
  }
}

export interface GlowEffect {
  radius(): number;
  radius(v: number): this;
  intensity(): number;
  intensity(v: number): this;
  color(): string;
  color(v: string): this;
  threshold(): number;
  threshold(v: number): this;
}
```

- [ ] **Step 3: Implement heatmap.ts** (luminance → multi-stop color ramp; paper-inspired, hand-written)

```ts
// packages/effects/src/filters/heatmap.ts
import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec4 u_colors[8];
uniform float u_colorsCount;
uniform float u_contour;   // 0 = smooth ramp; N = banded into N steps
uniform float u_angle;     // radians — directional gradient axis
uniform float u_direction; // 0 = pure luminance, 1 = pure directional gradient
uniform float u_offset;    // scrolls the ramp (animatable)
out vec4 fragColor;
void main() {
	vec4 c = texture(u_texture, v_uv);
	vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	float axis = dot(v_uv - 0.5, vec2(cos(u_angle), sin(u_angle))) + 0.5;
	float v = fract(mix(lum, axis, u_direction) + u_offset);
	if (u_contour > 0.5) v = floor(v * u_contour) / max(u_contour - 1.0, 1.0);
	float pos = clamp(v, 0.0, 1.0) * (u_colorsCount - 1.0);
	vec3 ramp = u_colors[0].rgb;
	for (int i = 0; i < 7; i++) {
		if (float(i) < u_colorsCount - 1.0) {
			float t = clamp(pos - float(i), 0.0, 1.0);
			ramp = mix(ramp, u_colors[i + 1].rgb, t);
		}
	}
	fragColor = vec4(ramp * c.a, c.a);
}`;

const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#000428", "#004e92", "#2c7a4b", "#e8e026", "#ff6b08", "#ff0000"],
    max: 8,
  },
  contour: { type: "number", uniform: "u_contour", default: 0, min: 0, max: 32, step: 1 },
  angle: { type: "number", uniform: "u_angle", default: 0, min: 0, max: 360, step: 1, unit: "deg" },
  direction: { type: "number", uniform: "u_direction", default: 0, min: 0, max: 1, step: 0.01 },
  offset: { type: "number", uniform: "u_offset", default: 0, min: -1, max: 1, step: 0.01 },
};

export type HeatmapConfig = EffectConfig & {
  colors?: string[];
  contour?: number;
  angle?: number;
  direction?: number;
  offset?: number;
};

export class HeatmapEffect extends Effect {
  constructor(config: HeatmapConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface HeatmapEffect {
  colors(): string[];
  colors(v: string[]): this;
  contour(): number;
  contour(v: number): this;
  angle(): number;
  angle(v: number): this;
  direction(): number;
  direction(v: number): this;
  offset(): number;
  offset(v: number): this;
}
```

- [ ] **Step 4: Run — PASS.** Export both from barrel. All 8 filters now exported.

---

## Phase E — generative sources

### Task 15: ShaderSource base node

**Files:**
- Create: `packages/effects/src/source.ts`
- Create: `packages/effects/tests/source.test.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/effects/tests/source.test.ts
import { describe, expect, it } from "vitest";
import { ShaderSource } from "../src/source.js";
import type { ParamSchema } from "../src/params.js";

const SCHEMA: ParamSchema = {
  speed: { type: "number", uniform: null, default: 1 },
  scale: { type: "number", uniform: "u_scale", default: 2 },
};

class TestSource extends ShaderSource {
  constructor(config: Record<string, unknown> = {}) {
    super(SCHEMA, "void main(){}", config);
  }
}
interface TestSource {
  scale(): number;
  scale(v: number): this;
}

describe("ShaderSource", () => {
  it("is a Konva shape with flex leaf role and schema accessors", () => {
    const s = new TestSource({ width: 100, height: 50, scale: 3 });
    expect(s._kmRole).toBe("leaf");
    expect(s.scale()).toBe(3);
    s.scale(4);
    expect(s.scale()).toBe(4);
    expect(s.width()).toBe(100);
  });
});
```

- [ ] **Step 2: Run — FAIL.** (Konva imports fine in Node; no canvas needed until drawing.)

- [ ] **Step 3: Implement**

```ts
// packages/effects/src/source.ts
import Konva from "konva";
import {
  type EffectFrameContext,
  FlexShape,
  getComposition,
  getEffectRuntime,
  type LeafConfig,
} from "@smoove/core";
import {
  buildAccessors,
  defaultsFromSchema,
  type ParamSchema,
  paramsToUniforms,
  pickSchemaConfig,
} from "./params.js";
import { ensureEffectRuntime } from "./runtime/runtime.js";

export type ShaderSourceConfig = LeafConfig & { speed?: number };

/**
 * Base for generative shader nodes (MeshGradient, Metaballs, ...): a flex-aware
 * Konva shape whose pixels come from a fragment shader with no input texture.
 * Sized by layout (or explicit width/height); animated from the composition
 * clock; can itself take `effects: [...]` like any node.
 */
export abstract class ShaderSource extends FlexShape<Konva.Shape, ShaderSourceConfig>(Konva.Shape) {
  /** Exposed for the Studio props panel. */
  readonly schema: ParamSchema;
  protected readonly _values: Record<string, unknown>;
  private readonly _fragment: string;

  protected constructor(schema: ParamSchema, fragment: string, config: Record<string, unknown> = {}) {
    super(config as ShaderSourceConfig);
    ensureEffectRuntime();
    this.schema = schema;
    this._fragment = fragment;
    this._values = { ...defaultsFromSchema(schema), ...pickSchemaConfig(schema, config) };
    buildAccessors(this, schema);
    this.sceneFunc((ctx) => this._drawShader(ctx));
  }

  /** @internal accessor plumbing (see buildAccessors). */
  _kmParamGet(key: string): unknown {
    return this._values[key];
  }

  /** @internal */
  _kmParamSet(key: string, v: unknown): this {
    if (this._values[key] !== v) {
      this._values[key] = v;
      this.getLayer()?.batchDraw();
    }
    return this;
  }

  private _drawShader(ctx: Konva.Context): void {
    const runtime = getEffectRuntime();
    if (!runtime) return;
    const w = Math.max(1, Math.round(this.width()));
    const h = Math.max(1, Math.round(this.height()));
    const stage = this.getStage();
    const comp = stage ? getComposition(stage) : null;
    const frame = comp ? comp.frame.get() : 0;
    const fps = comp ? comp.fps : 30;
    const fctx: EffectFrameContext = {
      frame,
      time: frame / fps,
      fps,
      width: w,
      height: h,
      pixelRatio: 1,
    };
    const out = runtime.renderSource(
      { fragment: this._fragment, uniforms: paramsToUniforms(this.schema, this._values, fctx) },
      w,
      h,
    );
    if (out) ctx.drawImage(out, 0, 0, w, h);
  }
}
```

- [ ] **Step 4: Run — PASS.** Export `ShaderSource, type ShaderSourceConfig` from barrel. Build + check.

### Task 16: Vendor paper-shaders — NOTICE, MeshGradient, Waves

**Files:**
- Create: `packages/effects/NOTICE`
- Create: `packages/effects/src/glsl/vendor/README.md`
- Create: `packages/effects/src/glsl/vendor/mesh-gradient.ts`
- Create: `packages/effects/src/glsl/vendor/waves.ts`
- Create: `packages/effects/src/sources/mesh-gradient.ts`
- Create: `packages/effects/src/sources/waves.ts`
- Modify: `packages/effects/tests/runtime.test.ts` (compile tests)

Upstream (Apache-2.0, github.com/paper-design/shaders @ main):
- `packages/shaders/src/shaders/mesh-gradient.ts` — exports `meshGradientFragmentShader` + `meshGradientMeta` (param defaults)
- `packages/shaders/src/shaders/waves.ts` — `wavesFragmentShader` + defaults
- `packages/shaders/src/shader-sizing.ts` — GLSL sizing helper chunks their fragments interpolate

- [ ] **Step 1: NOTICE + vendor README**

`packages/effects/NOTICE`:

```
This package includes GLSL shader code derived from Paper Shaders
(https://github.com/paper-design/shaders), Copyright Paper Design,
licensed under the Apache License, Version 2.0.
Modifications: adapted uniform names/time handling to the smoove effect
runtime, GLSL ES 1.00-compatible rewrites, removed sizing/fit system.
```

`src/glsl/vendor/README.md`: one paragraph stating origin, license, adaptation rules (below), and that every vendored fragment must keep a `// Derived from paper-design/shaders <file> (Apache-2.0)` header comment.

- [ ] **Step 2: Vendor each fragment** into `src/glsl/vendor/<name>.ts` as `export const <name>FragmentShader = \`...\`;`

Adaptation checklist (apply to every vendored fragment; the same checklist repeats in Task 17):
1. Copy the upstream fragment template string; inline any `${sizingXyz}` interpolations it references from `shader-sizing.ts`, then **delete the fit/scale/rotation sizing math** — replace the sized UV with plain `v_uv` stretched to the node (v1 behavior; fit options are deferred).
2. Keep upstream param uniforms (`u_colors[N]`, `u_colorsCount`, `u_distortion`, `u_swirl` for mesh-gradient; the wave shape/amplitude/frequency uniforms for waves). Keep `u_time` as-is (our runtime supplies composition-clock time).
3. Rewrite to the ES-1.00-compatible subset: replace array constructors with per-element assignment, `switch` with if-chains, non-constant loop bounds with constant bounds + inner `if` guards, and any `texture`/ES3-only builtins per transpile.ts rules.
4. Header comment: `// Derived from paper-design/shaders packages/shaders/src/shaders/<file> (Apache-2.0). See NOTICE.`

- [ ] **Step 3: Node classes** — same shape for each source (MeshGradient shown; Waves is identical modulo schema):

```ts
// packages/effects/src/sources/mesh-gradient.ts
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";
import { meshGradientFragmentShader } from "../glsl/vendor/mesh-gradient.js";

// Defaults mirror upstream meshGradientMeta — verify against the vendored file.
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"],
    max: 8,
  },
  distortion: { type: "number", uniform: "u_distortion", default: 0.8, min: 0, max: 1, step: 0.01 },
  swirl: { type: "number", uniform: "u_swirl", default: 0.1, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type MeshGradientConfig = ShaderSourceConfig & {
  colors?: string[];
  distortion?: number;
  swirl?: number;
  speed?: number;
};

export class MeshGradient extends ShaderSource {
  constructor(config: MeshGradientConfig = {}) {
    super(SCHEMA, meshGradientFragmentShader, config);
  }
}

export interface MeshGradient {
  colors(): string[];
  colors(v: string[]): this;
  distortion(): number;
  distortion(v: number): this;
  swirl(): number;
  swirl(v: number): this;
  speed(): number;
  speed(v: number): this;
}
```

- [ ] **Step 4: Compile tests** — append to `tests/runtime.test.ts` inside the `describe.skipIf(!platform)` block, one per vendored source; these prove the ES-1.00 rewrite actually transpiles and compiles on headless-gl:

```ts
  it("vendored source shaders compile and render on WebGL1", async () => {
    const { meshGradientFragmentShader } = await import("../src/glsl/vendor/mesh-gradient.js");
    const { wavesFragmentShader } = await import("../src/glsl/vendor/waves.js");
    const rt = new EffectRuntime(platform!);
    for (const fragment of [meshGradientFragmentShader, wavesFragmentShader]) {
      const out = rt.renderSource(
        {
          fragment,
          uniforms: {
            u_time: 0.5,
            u_colors: [[1, 0, 0, 1], [0, 0, 1, 1]],
            u_colorsCount: 2,
          },
        },
        8,
        8,
      );
      expect(out).not.toBeNull();
    }
    const px = platform!.readPixels();
    expect(px.some((v) => v > 0)).toBe(true); // drew something
  });
```

- [ ] **Step 5: Run — PASS.** Export `MeshGradient`, `Waves` (+ config types) from barrel. Build + check.

### Task 17: Vendor Metaballs + GodRays

**Files:**
- Create: `packages/effects/src/glsl/vendor/metaballs.ts` (upstream `packages/shaders/src/shaders/metaballs.ts`)
- Create: `packages/effects/src/glsl/vendor/god-rays.ts` (upstream `packages/shaders/src/shaders/god-rays.ts`)
- Create: `packages/effects/src/sources/metaballs.ts`
- Create: `packages/effects/src/sources/god-rays.ts`
- Modify: `packages/effects/tests/runtime.test.ts`

- [ ] **Step 1–4:** Repeat Task 16's Steps 2–5 exactly for the two shaders. Schemas (verify defaults against upstream meta when vendoring):
  - `Metaballs`: `colors` (colors → `u_colors`, max 8), `count` (number → `u_count`, default 7, min 1, max 15, step 1), `size` (number → `u_size`, default 0.75, min 0, max 1), `speed` (uniform: null, default 1).
  - `GodRays`: `colors` (colors → `u_colors`, max 8), `frequency` (number → `u_frequency`, default 3, min 0, max 10), `spotty` (number → `u_spotty`, default 0.3, min 0, max 1), `midIntensity` (number → `u_midIntensity`, default 0.5, min 0, max 1), `density` (number → `u_density`, default 0.5, min 0, max 1), `speed` (uniform: null, default 1).

Add both to the vendored compile test's fragment list, extending the uniforms object with the numeric uniforms above (extra uniforms on shaders that lack them are harmless — locations resolve to null and are skipped).

Export `Metaballs`, `GodRays` (+ config types) from barrel. Tests + build + check pass.

---

## Phase F — server rendering

### Task 18: Wire headless-gl into the effects runtime

**Files:**
- Modify: `packages/renderer/src/gl.ts`
- Modify: `packages/renderer/package.json`

- [ ] **Step 1: Optional peer** — in `packages/renderer/package.json` add:

```json
  "peerDependencies": {
    "@smoove/effects": "workspace:^"
  },
  "peerDependenciesMeta": {
    "@smoove/effects": { "optional": true }
  }
```

(merge into the existing peerDependencies block), and add `"@smoove/effects": "workspace:*"` to its devDependencies so the build can typecheck the dynamic import.

- [ ] **Step 2: Extend gl.ts** — append to `packages/renderer/src/gl.ts`:

```ts
/**
 * Route `@smoove/effects` node/layer effects and shader sources through the
 * same headless-gl + skia platform used for shader transitions, so they render
 * in Node. No-op (with the same one-time hint) when `gl` is missing, and
 * silently skipped when @smoove/effects isn't installed.
 *
 * Async because @smoove/effects is an optional ESM peer; `@smoove/renderer/gl`
 * awaits it at module top level, so `import "@smoove/renderer/gl"` is enough.
 */
export async function enableNodeShaderEffects(): Promise<void> {
  let effects: typeof import("@smoove/effects");
  try {
    effects = await import("@smoove/effects");
  } catch {
    return; // effects package not installed — nothing to wire
  }
  effects.setEffectPlatformFactory(() => {
    const platform = createNodeGlPlatform();
    if (!platform) {
      if (!warned) {
        warned = true;
        console.warn(
          "@smoove/renderer: shader effects need the optional `gl` (headless-gl) package — install it to render them, otherwise nodes draw unfiltered.",
        );
      }
      return null;
    }
    return platform;
  });
}

await enableNodeShaderEffects();
```

Note: `createNodeGlPlatform()` returns transitions' `GlPlatform`, which is structurally identical to `EffectGlPlatform` — TS accepts it as-is. Reuse the existing `warned` flag (rename its warning copy to mention both transitions and effects if Biome flags anything). Top-level `await` is valid in this ESM Node package; if `tsc` complains, bump that tsconfig's `module`/`target` per the error (NodeNext already supports it).

- [ ] **Step 3: Build + verify server render**

Run: `pnpm build`
Then verify with the demo's render queue after Task 20 (the demo composition renders server-side through `/api/render`), or minimally:

```bash
node -e "import('@smoove/renderer/gl').then(() => console.log('gl subpath loads'))"
```

Expected: `gl subpath loads` with no unhandled rejection.

---

## Phase G — demo, docs, deprecation verification

### Task 19: Effects showcase demo composition

**Files:**
- Create: `demo/src/compositions/effects-showcase/index.ts`
- Modify: `demo/src/registry.ts`
- Modify: `demo/package.json` (add `"@smoove/effects": "workspace:*"` to dependencies)

- [ ] **Step 1: Write the composition** (follow the shape of an existing entry, e.g. `demo/src/compositions/colors/index.ts`, for the `defineRegistry` item contract — id/title/build signature must match the registry's existing entries):

```ts
// demo/src/compositions/effects-showcase/index.ts
import { Composition, Flex, Image, Sequence, Text } from "@smoove/core";
import {
  BlurEffect,
  ColorKeyEffect,
  GlowEffect,
  HeatmapEffect,
  MeshGradient,
  NoiseGrainEffect,
} from "@smoove/effects";

// Mirror the export shape of demo/src/compositions/colors/index.ts exactly.
export default {
  id: "effects-showcase",
  title: "Effects showcase",
  durationInFrames: 240,
  fps: 30,
  width: 1280,
  height: 720,
  build(comp: Composition) {
    // Scene 1 (0–120): MeshGradient background + heatmap'd image + glowing title.
    const scene1 = new Sequence({ from: 0, durationInFrames: 120 });
    const bg = new MeshGradient({
      width: 1280,
      height: 720,
      colors: ["#0b1020", "#1d4ed8", "#9333ea"],
      speed: 0.6,
    });
    scene1.add(bg);

    const heatmap = new HeatmapEffect({ contour: 12, direction: 0.4 });
    const blur = new BlurEffect({ radius: 0 });
    const logo = new Image({
      src: "/assets/logo.png", // any existing demo asset; reuse one referenced by other demos
      x: 440,
      y: 160,
      width: 400,
      height: 400,
      effects: [heatmap, blur],
    });
    scene1.add(logo);

    const title = new Text({
      x: 0,
      y: 580,
      width: 1280,
      text: "shader effects",
      fontSize: 64,
      align: "center",
      fill: "#ffffff",
      effects: [new GlowEffect({ color: "#66ccff", radius: 24, intensity: 1.2 })],
    });
    scene1.add(title);

    scene1.register((f) => {
      heatmap.enable(f < 100);          // the spec's target API, verbatim
      heatmap.offset(f / 120);
      blur.radius(f > 90 ? (f - 90) * 2 : 0);
    });

    // Scene 2 (120–240): colorKey + layer-wide grain.
    const scene2 = new Sequence({
      from: 120,
      durationInFrames: 120,
      effects: [new NoiseGrainEffect({ amount: 0.15 })],
    });
    const keyed = new Image({
      src: "/assets/greenscreen.jpg", // add a small CC0 greenscreen still under demo/public/assets/
      width: 1280,
      height: 720,
      effects: [new ColorKeyEffect({ color: "#00ff00", similarity: 0.3 })],
    });
    scene2.add(keyed);

    comp.add(scene1);
    comp.add(scene2);
  },
};
```

(Adjust the `export default` shape to whatever `defineRegistry` actually expects — copy a neighboring composition file's skeleton first; the animation/effects content above is the deliverable.)

- [ ] **Step 2: Register** — in `demo/src/registry.ts` add `import effectsShowcase from "./compositions/effects-showcase/index.js";` (grouped under a new `// Effects.` comment) and add it to the registry list next to its alphabetical neighbors.

- [ ] **Step 3: Verify in the browser**

Run: `pnpm install && pnpm build`, then start the demo dev server and check the composition renders: MeshGradient animates, heatmap toggles off at frame 100, blur ramps after frame 90, glow visible on the title, green keyed out in scene 2, grain over the whole second scene. Use the preview tooling (per repo memory: demo dev server is pinned to **:5174**) and sample pixels/screenshot rather than trusting console silence.

- [ ] **Step 4: Verify server parity** — render the composition through the demo's render queue (`/queue` UI or `/api/render`) with `gl` installed; if `gl` isn't installed, expect the one-time renderer warning and unfiltered output (that's the designed fallback, not a bug).

### Task 20: Deprecation warning verification

**Files:** none new (behavior landed in Task 2).

- [ ] **Step 1:** In the running demo, from the browser console, grab any smoove node and call `node.filters([])` — expect the one-time `[smoove] Konva filters ... deprecated` warning exactly once per page load.
- [ ] **Step 2:** Confirm a node with `effects` but with `@smoove/effects` never imported (e.g. temporarily comment the import in a scratch composition) warns `no effect runtime is registered` once and still draws unfiltered.

### Task 21: Docs

**Files:**
- Modify: `doc/README.md` (add an "Effects" section — required by AGENTS.md on public API change)
- Modify: `AGENTS.md` (add the packages/effects row to the Layout table)
- Modify: `skills/smoove-video/SKILL.md` (add an effects vocabulary note)
- Create: `packages/docs/content/docs/effects.mdx` (+ demo registration under `packages/docs/src/demos/` and a `meta.json` entry, following any existing docs page + `<Demo>` pairing)

- [ ] **Step 1: AGENTS.md row** (in the Layout table, after `packages/transitions`):

```
packages/effects       @smoove/effects: hardware-accelerated shader effects. An `effects: [...]` prop on any node/Sequence (8 filters: blur, colorKey, glow, ...) plus generative ShaderSource nodes (MeshGradient, Metaballs, Waves, GodRays) ported from paper-design/shaders (Apache-2.0, see NOTICE). One shared WebGL2 context in the browser; headless-gl via @smoove/renderer/gl on the server. konva and core are peerDeps.
```

- [ ] **Step 2: doc/README.md** — add an `## Effects` section after the transitions section covering: the `effects` config on nodes and Sequences, constructing effects, animating params inside `register` (use the spec's target API example verbatim), source nodes in flex layout, server rendering note (`import "@smoove/renderer/gl"` + optional `gl` package), and the Konva-filters deprecation note ("Konva `filters`/`cache()` are CPU ImageData loops; smoove effects run on the GPU — don't mix them").

- [ ] **Step 3: smoove-video skill** — add a short "Effects" subsection: import from `@smoove/effects`, attach via `effects: [...]`, animate via generated accessors in `register`, sources are layout-aware nodes. Follow the skill's existing formatting conventions.

- [ ] **Step 4: Docs site page** — `effects.mdx` with a live `<Demo>` per effect family (one filters demo, one sources demo), registered like the existing demos in `packages/docs/src/demos/*.ts`. Add the page to the section's `meta.json`. Run `pnpm dev:docs` (port 5176) and verify both demos play.

- [ ] **Step 5: Final full verification**

```bash
pnpm build && pnpm check && pnpm --filter @smoove/effects test
```

Expected: all green. Leave everything uncommitted.

---

## Self-review checklist (run after writing, fixed inline)

- Spec coverage: contract+hook (T1–2), node effects (T3–4), Sequence effects (T5), package (T6), runtime/one-context/ping-pong (T7–8), schema accessors + determinism (T9), 8 filters incl. must-haves blur/colorKey (T10–14), sources as nodes (T15–17), server via headless-gl + fallback warning (T18), deprecation (T2/T20), docs + skill + AGENTS.md (T21), Vitest incl. pixel determinism (T8, T11, T16). Deferred items from the spec intentionally have no tasks.
- Known judgment calls an implementer may adjust: exact glow composite math (tune visually in the demo), vendored schema defaults (verify against upstream meta files), demo registry entry shape (copy a neighbor).
