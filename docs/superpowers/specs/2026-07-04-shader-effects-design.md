# Shader Effects for smoove — Design

**Date:** 2026-07-04
**Status:** Approved design, pending implementation plan

## Goal

Give every smoove element hardware-accelerated visual effects via WebGL fragment
shaders, and make that the blessed path instead of Konva's CPU filter system
(`node.cache()` + `filters: [...]`), which is deprecated for smoove nodes.

Target API (from the original request):

```ts
import { HeatmapEffect, BlurEffect, MeshGradient } from "@smoove/effects";

const heatmap = new HeatmapEffect({ colors: ["#00f", "#f00"], angle: 0 });
const logo = new Image({ src: logoUrl, effects: [heatmap, new BlurEffect({ radius: 8 })] });

const bg = new MeshGradient({ flex: 1, colors: ["#111", "#0af"], speed: 0.5 });

scene.register((f) => {
  heatmap.enable(f < 100);
  heatmap.angle(f * 2);
});
```

## Decisions made during brainstorming

| Question | Decision |
| --- | --- |
| Effect kinds | Both **filters** (post-process a node's pixels) and **generative sources** (shader-drawn nodes) in v1 |
| Targets | Any smoove node **and** `Sequence` (whole-layer post-pass). Composition-level chain deferred |
| Server rendering | Required in v1, via headless-gl (same pattern as shader transitions) |
| Packaging | Contract + hook in `@smoove/core`; runtime + catalog in a new `@smoove/effects` package |
| Sources API | Generative shaders are **drawable nodes** (participate in flex layout), not fills |
| Catalog size | Core set of ~12; `Blur` and `ColorKey` are must-haves |
| Mechanism | **Draw interception** (offscreen render → shared WebGL2 context → shader chain → drawImage back). Rejected: GPU-backed Konva filters (forces per-frame GPU→CPU→GPU readback), WebGL overlay layer (breaks z-order and clipping) |

## Prior art in this repo

`@smoove/transitions` Tier B presentations already run GLSL fragment shaders
through a `GlCompositor` (`packages/transitions/src/gl/compositor.ts`) over a
`GlPlatform` abstraction: browser WebGL2 canvas, or headless-gl + skia on the
server (`packages/renderer/src/gl-node.ts`, injected by `@smoove/renderer/gl`),
with GLSL `300 es` → `100` transpiling and graceful fallback. The effects
runtime generalizes this pattern from "two scene textures, one pass" to "one
input texture (or none), N chained passes". Transitions are **not** migrated to
the new runtime in v1; that is a possible later cleanup.

## Architecture

### Package responsibilities

- **`@smoove/core`** — a small open contract mirroring `KMLayoutNode`
  (`layout/contract.ts`): the `KMEffect` interface, an `effects` config/attr on
  every wrapper node and on `Sequence`, the draw-interception logic, and a
  `setEffectRuntime()` registration point. Core stays GL-free. With no runtime
  registered, nodes draw normally and a dev-mode warning fires once.
- **`@smoove/effects`** (new; `konva` and `@smoove/core` as peerDeps) — the
  `Effect` base class, the `ShaderSource` base node, the shared WebGL runtime,
  and the effect catalog. Constructing any effect registers the runtime with
  core, so there are no import-order requirements.
- **`@smoove/renderer`** — the existing `./gl` subpath additionally wires a
  headless-gl platform into the effects runtime. `@smoove/effects` is an
  optional peer resolved via dynamic import.

### Licensing

- paper-design/shaders is **Apache 2.0**: its GLSL is vendored under
  `packages/effects/src/glsl/vendor/` with LICENSE/NOTICE preserved, adapted to
  the runtime's uniform conventions.
- Remotion's `@remotion/effects` is under Remotion's paid-for-companies
  license: **no code is copied**. Blur, glow, chromatic aberration, etc. are
  standard techniques written from scratch (inspiration only).

### Core contract (`core/src/effects/contract.ts`)

```ts
type UniformValue = number | boolean | number[] /* vec2/3/4, mat3/4 */;

interface EffectFrameContext {
  frame: number;      // composition frame
  time: number;       // frame / fps (seconds) — never wall clock
  fps: number;
  width: number;      // texture size (layer size in v1)
  height: number;
  pixelRatio: number;
}

interface KMEffect {
  readonly _kmEffect: true;
  enabled(): boolean;
  /** Stable fragment source — the runtime's program-cache key. */
  _kmFragment(): string;
  /** Uniform values for this frame. Pure in (params, ctx). */
  _kmUniforms(ctx: EffectFrameContext): Record<string, UniformValue>;
  /** Attach/detach bookkeeping so param setters can dirty owning layers. */
  _kmAttach(node: Konva.Node): void;
  _kmDetach(node: Konva.Node): void;
}

function isKMEffect(v: unknown): v is KMEffect;

/** Runtime injection point; called by @smoove/effects. */
function setEffectRuntime(runtime: KMEffectRuntime | null): void;

interface KMEffectRuntime {
  /** Run the enabled chain over `input`; returns an image to draw, or null on failure. */
  applyChain(
    input: CanvasImageSource,
    effects: KMEffect[],
    ctx: EffectFrameContext,
  ): CanvasImageSource | null;
  /** Render a generative source (no input texture) at the given size. */
  renderSource(
    fragment: string,
    uniforms: Record<string, UniformValue>,
    ctx: EffectFrameContext,
  ): CanvasImageSource | null;
  dispose(): void;
}
```

### Draw interception in core

- Every wrapper accepts `effects?: KMEffect[]` in config, stored as an attr
  with a Konva-style `effects()` accessor (the attr setter runs
  attach/detach bookkeeping). This lands in the `FlexShape` mixin for shape
  wrappers and in the Group-based nodes (`Flex`, `Block`, `Image`, `Text`).
- Both `Konva.Shape` and `Konva.Group` subclasses override `drawScene`. Fast
  path first: if there are no effects, no enabled effect, or no registered
  runtime, call `super.drawScene` untouched — zero overhead.
- Effected path: the subtree renders into a **reused, layer-sized scratch
  scene canvas**; the runtime uploads it once as a texture, runs all enabled
  passes ping-ponging between two framebuffers, and the result is drawn onto
  the real layer canvas (browser: 2D-canvas `drawImage` from the WebGL canvas —
  no pixel readback; server: `readPixels` into a skia canvas).
- **Layer-space rendering (v1 tradeoff):** the texture is the full layer size,
  which makes transforms trivial and lets blur/glow bleed correctly outside
  the node's bounds. Cost is one layer-sized offscreen render + texture upload
  per effected node per frame. Per-node bounding-box textures (with configurable
  outset padding) are an explicit later optimization, not in v1.
- **`Sequence.effects`:** each Sequence owns its own canvas, so layer-wide
  effects run as a post-pass on that canvas after children draw (e.g. film
  grain over a whole scene).
- `Composition.destroy()` disposes the runtime's GPU resources.
- Runtime failure (context lost, compile error) logs once and falls back to
  the unfiltered draw — a broken shader never blanks the composition.

### `@smoove/effects` runtime

- **One shared WebGL2 context** for all effects (browsers cap contexts at
  ~8–16; paper-shaders' context-per-element model is deliberately replaced).
  Program cache keyed by fragment source; two ping-pong framebuffers; a scratch
  texture for the input upload.
- Platform abstraction shaped like transitions' `GlPlatform`
  (resize / uploadScene / result / prepareFragment), so browser and headless-gl
  backends share all plumbing. Includes the `300 es` → `100` transpile for
  WebGL1-only headless-gl.
- Uniform conventions: `u_texture` (input, filters only), `u_resolution`,
  `u_time` (composition-clock seconds × effect `speed`), `u_pixelRatio`, plus
  per-effect uniforms from the schema.
- Shader compilation is synchronous at first use (a few ms); no
  `delayRender`/buffer-state integration needed. Procedural noise textures
  (paper's `getShaderNoiseTexture` equivalent) are generated synchronously and
  cached.

### Effect base class & param schemas

- Each effect declares a **param schema**: name, GLSL uniform, type
  (`number | boolean | color | colors | enum | vec2`), default, min/max/step.
  From it the base class generates Konva-Factory-style accessors
  (`heatmap.angle()` get, `heatmap.angle(90)` set), plus `set({...})` bulk,
  `enable(bool)`, and `enabled()`.
- The schema is exported per effect so the Studio props panel (SchemaForm) can
  render effect controls later — same philosophy as `defineRegistry()`.
- Effect instances are plain objects (not Konva nodes) and **shareable across
  nodes**: params are read at each node's draw; the compiled program is shared.
- Param setters and `enable()` call `batchDraw()` on attached nodes' layers so
  effects animate outside `register` callbacks too (studio scrubbing, static
  comps). Inside `register` this is coalesced by Konva's batchDraw as usual.
- Color params accept the same color strings core accepts and are converted to
  vec3/vec4 uniforms (reuse `animation/color.ts`).
- Determinism: all time-like uniforms derive from `EffectFrameContext`
  (frame/fps), never `performance.now()` — browser playback and server renders
  are pixel-identical.

### Generative sources

- `ShaderSource` extends a `Konva.Shape` wrapper through the same flex
  contract as other leaves: flex-sized (or explicit width/height),
  sequence-gated, z-ordered. Its `sceneFunc` asks the runtime to render its
  fragment at the node's laid-out size and draws the result.
- Sources expose the same schema-generated accessors and `speed` param, and can
  themselves take `effects: [...]` (they are ordinary nodes).

## Catalog (v1 — 12 effects)

**Filters (8)** — written from scratch unless noted:

| Effect | Params (sketch) |
| --- | --- |
| `Blur` | radius, horizontal, vertical (two-pass gaussian) |
| `ColorKey` | color, similarity, smoothness, spill (chroma key) |
| `Glow` | color, radius, intensity |
| `ChromaticAberration` | amount, angle |
| `Pixelate` | size |
| `Vignette` | amount, radius, softness, color |
| `NoiseGrain` | amount, size, animated |
| `Heatmap` | colors, contour, angle, speed *(paper port)* |

**Sources (4)** — all paper ports: `MeshGradient`, `Metaballs`, `Waves`,
`GodRays`.

The rest of the paper catalog (halftone, dithering, liquid metal, voronoi,
fluted glass…) ports incrementally afterward; with the runtime in place each
new effect is ≈ one GLSL file + one schema.

## Server rendering

- `@smoove/renderer/gl` gains effects wiring alongside
  `enableNodeShaderTransitions()`. Mirroring transitions'
  `setCompositorFactory`, `@smoove/effects` exposes a platform-factory
  override; the renderer injects the headless-gl platform (upload skia canvas
  → shader → `readPixels` → skia canvas), and the effects package builds its
  runtime on it and registers that with core via `setEffectRuntime`.
- If the optional `gl` package is missing, effects are skipped with a one-time
  warning and nodes render unfiltered — the same philosophy as transitions
  falling back to `fade()`.

## Deprecating Konva filters

- Konva `filters`/`cache()` are not used anywhere in this repo, so this is
  guidance, not migration: a one-time dev-mode warning when `filters` is set on
  a smoove wrapper, pointing at `@smoove/effects`.
- Docs get an explicit "why not Konva filters" note (CPU ImageData loops +
  cache invalidation cost vs. GPU passes).

## Testing

First Vitest in the repo, scoped to `packages/effects` (per AGENTS.md: add
per-package when there's logic worth testing):

- Pure unit tests: schema → accessor generation, enable/attach bookkeeping,
  chain ordering, uniform mapping (including color conversion and time
  derivation).
- Deterministic pixel tests: run the real runtime against headless-gl (devDep)
  for a couple of effects and assert stable snapshots — same frame in, same
  pixels out, which is the property the whole system promises.

## Docs & follow-ups (in scope for the implementation plan)

- Update `doc/README.md` (AGENTS.md requires it on public API changes).
- Docs-site page with live `<Demo>` players per effect.
- Teach the `smoove-video` skill the effects vocabulary.
- New package checklist: `pnpm-workspace.yaml` is already `packages/*`; add the
  project reference to the root `tsconfig.json`; `tsc -b` build like other
  packages.

## Explicitly deferred

- Composition-level effect chain on the final composited frame.
- Per-node bounding-box textures (perf optimization over layer-space).
- Migrating `@smoove/transitions` onto the shared runtime.
- Studio UI for editing effect params (schemas are designed for it).
- Custom user-authored effects API docs (`class MyEffect extends Effect` will
  work; polishing/documenting it is a follow-up).
- WebGPU backend (contract keeps fragment sources as data, so a future backend
  slot exists).
