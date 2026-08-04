# @smoove/effects and the flameWrap preset

Build the effects system specified in `doc/effects-v2-design.md`, with
`flameWrap` as its only preset: animated fire that wraps the alpha silhouette
of any smoove node, with heat distortion, sparks, molten rim, smoke and
scorch.

Date: 2026-08-03. Status: approved design, not yet planned.

## Background

`doc/effects-v2-design.md` (2026-07-07) is an approved but unimplemented
design for a Canvas2D-first effects system: an `effects: SmooveEffect[]` hook
in core plus a small `@smoove/effects` package. It specified four presets
(blur, chromaKey, shine, water). Nothing from it exists on main.

This spec keeps that infrastructure essentially intact and changes the preset
set to one: `flameWrap`, inspired by the effect of the same name in
[Canvas UI](https://canvasui.dev/docs/components/flame-wrap).

Canvas UI is MIT + Commons Clause, and its terms forbid redistributing its
components "whether alone, in a bundle, or as a port". We take inspiration
only: the taxonomy, the parameter vocabulary and the technique choice. Every
line of shader and TypeScript here is written from scratch. Their fragment
source is not consulted as a copy target.

### What the reference does, and why it fits

Canvas UI's Flame Wrap is a **single-pass WebGL2 fragment shader**: one
content texture, layered snoise/fbm octaves, one draw. It reads the element's
alpha to find burn edges. It needs no pointer input, and time enters only
through a `uTime` uniform with hash-based (non-accumulating) sparks.

That shape matters on two counts:

- It maps onto `GlCompositor` (`packages/transitions/src/gl/gl-transition.ts`)
  almost exactly — one fragment program, bound textures, one `drawArrays`. No
  framebuffer ping-pong, no float textures, no WebGL2-only pipeline.
- Swapping their rAF clock for `fc.time` makes it **frame-pure and fully
  seekable** with no state to unwind. Scrubbing the studio timeline to frame
  900 is as cheap and as correct as playing to it.

Their `prefers-reduced-motion` handling and `IntersectionObserver` pausing are
dropped: a video render must be deterministic and must not depend on
viewport state.

## Decisions

Settled during design, with the reasoning that produced them:

1. **True alpha silhouette, not an analytic box.** Fire follows the node's
   actual alpha, so a burning `Text` burns per letter and a cutout PNG burns
   along its cutout. The reference wraps a rounded rect (its `radius` option)
   and so never needs a distance field; we do. See "The cached SDF".
2. **All 21 parameters exposed**, six taught. They are uniforms, so the
   marginal runtime cost is nil. Docs and the `smoove-video` skill teach
   `color`, `intensity`, `height`, `speed`, `turbulence`, `sparks`; the rest
   are documented in a reference table.
3. **No GL degrades to no flames**, plus one `console.warn` per chain, plus a
   documented note. This matches the silent-fallback semantics transitions
   already ships. The browser player has WebGL2 and the renderer has
   headless-gl, so the path is narrow.
4. **`padding()` widens to per-side.** Flames reach `height` px (default 170)
   above the top edge but `spread` px (default 8) at the sides. A single
   scalar would pad a 200x40 title to 540x380 and shade mostly-transparent
   pixels every frame.

## Deviations from `doc/effects-v2-design.md`

Four, all discovered by reading the code the design describes. Each is a
correction, not a preference.

### 1. The whole GL bridge moves to core, not just the types

The v2 doc moves "the `GlPlatform` type, the shared vertex shader, and the
transpile helpers ... types and string transforms only, no GL dependency".
That is not sufficient: `GlCompositor` is the thing a `shader` pass needs to
run, and it lives in transitions. Leaving it there forces either
`@smoove/effects` → `@smoove/transitions` (a strange edge) or
`@smoove/core` → `@smoove/transitions` (effectively circular, since
transitions depends on core).

Therefore `packages/transitions/src/gl/` moves wholesale to
`packages/core/src/gl/`: `compositor.ts`, `shared.ts`, `transpile.ts`, and the
`GlUniforms` type from `transitions/src/types.ts`. `gl-transition.ts` stays in
transitions (it is transition-shaped). The moved files depend only on
`lib.dom` WebGL types, so core stays runtime-agnostic per its existing
contract.

Back-compat: `@smoove/transitions` re-exports every moved symbol from its
current barrel positions, so no consumer changes. `packages/renderer/src/gl.ts`
and `gl-node.ts` repoint their imports at `@smoove/core` (renderer already has
core as a peer dep).

### 2. `GlCompositor` gains a general pass entry point

`render()` has the transition baked into its signature: two canvases bound to
`u_prev`/`u_next`, `u_time` as progress, exactly two preallocated textures
(`prevTex`/`nextTex`).

It gains:

```ts
renderPass(
  fragment: string,
  sources: readonly CanvasImage[],   // bound to u_tex0..u_texN
  uniforms: GlUniforms,
  width: number,
  height: number,
): CanvasImageSource
```

backed by an indexed texture pool that grows on demand. `render()` becomes a
thin wrapper over it that keeps the `u_prev`/`u_next`/`u_time` naming, so
transitions is behaviourally untouched and its existing tests are the
regression net.

Uniform support stays as-is: `float`, `vec2`, `vec3`, `vec4`. Every flameWrap
param is a float or a `vec3`, so nothing new is needed.

### 3. No GPU-resident shader chaining in v1

The v2 doc says consecutive `shader` passes stay on the GPU between them. That
needs FBOs and has no v1 consumer — flameWrap is a one-pass chain. Each shader
pass reads back into the work canvas. Deferred, with a note in the code.

### 4. Shader chains are CPU-pinned on the server

The v2 doc's rule is "chains made only of `css` and `composite` passes run on
a `gpu: true` canvas ... any chain containing a `pixels` pass stays on CPU".
A `shader` pass belongs on the CPU side of that line too:
`uploadScene` in `packages/renderer/src/gl-node.ts` does
`ctx.getImageData(0, 0, width, height)` on the source canvas, so every shader
pass fully reads back the work canvas — the exact GPU-skia-readback path that
corrupted under the old GL interop loop.

Refined rule: **`css`/`composite` only → GPU work canvas; any `pixels` or
`shader` pass → CPU-pinned.**

Consequence: flameWrap does not get the measured 13x GPU win. Its per-frame
server cost is `getImageData` + fragment + `readPixels` + `putImageData` over
the padded region, so **padded region area is the dominant cost knob**. This
is why per-side padding earns its contract change, and why docs must steer
flameWrap onto individual nodes rather than Sequences — the reverse of the v2
doc's general "prefer Sequence-level effects" advice, because a Sequence-level
burn means a full-frame readback every frame.

## Architecture

### Core: `packages/core/src/effects/`

Three files, as the v2 doc specifies.

`contract.ts` — types and the `isSmooveEffect` guard. Unchanged from v2 except
`padding`:

```ts
type EffectPadding = number | { top: number; right: number; bottom: number; left: number };

interface SmooveEffect {
  readonly _fxEffect: true;
  enabled(): boolean;
  passes(fc: EffectFrameContext): EffectPass[];
  padding?(fc: EffectFrameContext): EffectPadding;
  attach(node: Konva.Node): void;
  detach(node: Konva.Node): void;
}
```

The pipeline normalizes a scalar to all four sides and takes the per-side max
across a chain.

`apply.ts` — `initNodeEffects`, `drawNodeWithEffects`, `applyLayerEffects`,
pass coalescing, pooled capture canvases, the re-entry guard, region rounding
to 32px device buckets. Structure cherry-picked from the abandoned `effects`
branch as the v2 doc describes.

`dirty.ts` — content versioning, per-chain param fingerprints, and the
translation carve-out, close to verbatim from the branch.

### `packages/core/src/gl/`

The moved bridge (deviation 1) plus `renderPass` (deviation 2).

### `packages/effects/`

New published package. `konva` and `@smoove/core` as peer deps. Modules:

- `flame-wrap.ts` — the `flameWrap()` factory, param typing and validation,
  uniform assembly, per-side padding derivation.
- `glsl/flame-wrap.frag.ts` — the fragment source as a template string.
- `sdf.ts` — the chamfer distance transform and its cache.
- `params.ts` — shared param plumbing (fingerprinting, invalidation on set).

## The cached SDF

The load-bearing performance idea.

Alpha-silhouette flames need each pixel's distance to the element's edge, for
`melt`, `rim`, `ember` and to anchor flame roots. Estimating that in-shader by
sampling alpha radially is what makes it unaffordable: 16 angles x 8 radii is
128 texture fetches per pixel, roughly 256M fetches at 1080p — hundreds of
milliseconds a frame. The reference avoids the problem entirely by wrapping an
analytic rounded rect.

So it is computed on the CPU **once per content version**:

- **On content change:** draw the node into a dedicated **CPU-pinned**
  offscreen at the padded region size, one `getImageData`, build an 8-bit
  signed distance field from the alpha channel with a two-pass chamfer
  transform (O(n), no per-pixel search), upload as `u_sdf`. Upload the content
  as `u_tex0`. Both stay GPU-resident.
- **Per frame:** bind two resident textures, set the uniforms, one
  `drawArrays`, one readback. Two texture lookups plus fbm math per pixel.
  Zero CPU pixel work.

The SDF source canvas is deliberately separate from the work canvas and always
CPU-pinned, so the SDF build never reads back a GPU-rasterized skia surface.

The dirty tracker supplies the content-version hook, and its translation
carve-out means a static burning title moving across frame never rebuilds its
SDF.

Units: the SDF is built in device pixels and stores device-pixel distances,
while every param (`height`, `spread`, `melt`, `distortion`, ...) is authored
in CSS pixels. The factory multiplies by `fc.pixelRatio` when assembling
uniforms, so a 1x preview and a 2x render look identical. This is explicit
because getting it wrong is invisible until someone renders at a different
scale.

## Shader authoring constraints

`transpileTo100` (`packages/transitions/src/gl/transpile.ts`) is four string
rewrites: strip `#version 300 es`, `out vec4 X` → `gl_FragColor`, `in` →
`varying`, `texture(` → `texture2D(`. Nothing else.

So the fragment is authored in `#version 300 es` restricted to the
GLSL-ES-1.00-safe subset from the first line:

- Float math only. **No** `floatBitsToUint`, bit shifts, XOR or `uint`/`uvec`
  anywhere — spark hashes use the classic `fract(sin(dot(p, k)) * m)` form.
- Constant loop bounds for the fbm octaves.
- No `round()`, `trunc()`, `%` on ints, `switch`, dynamic array indexing,
  `textureLod`/`textureGrad`, `inverse()`/`transpose()`.
- `texture(s, uv)` only, so the rewrite catches it.

A test compiles the fragment through both a WebGL2 and a WebGL1 path so a
WebGL2-only construct fails in CI rather than in someone's mp4.

## API

```ts
import { flameWrap } from "@smoove/effects";

const fire = flameWrap({ color: [1, 0.45, 0.1], height: 140, intensity: 0.8 });
title.effects([fire]);

seq.animate((frame) => {
  fire.intensity = interpolate(frame, [0, 20], [0, 0.8]);
});
```

All 21 params, defaults from the reference except `color`, which becomes a
warm flame instead of the reference's blue:

| param | type | default |
| --- | --- | --- |
| `color` | `[number, number, number]` | `[1, 0.45, 0.1]` |
| `intensity` | number | 0.5 |
| `height` | number | 170 |
| `spread` | number | 8 |
| `speed` | number | 0.25 |
| `scale` | number | 0.75 |
| `turbulence` | number | 0.5 |
| `turbulenceScale` | number | 0.5 |
| `turbulenceReach` | number | 25 |
| `sparks` | number | 1.5 |
| `sparkSize` | number | 0.35 |
| `sparkDensity` | number | 1 |
| `sparkSpeed` | number | 1 |
| `rim` | number | 2.5 |
| `melt` | number | 4.5 |
| `distortion` | number | 10 |
| `smoke` | number | 1.5 |
| `ember` | number | 2 |
| `scorch` | number | 0 |

The reference's `radius` is dropped (it exists to shape an analytic box; we use
the alpha silhouette). Setting any param invalidates the owning node's chain
via the standard `params.ts` plumbing.

Ignition is ambient: a seamless-looking looping burn driven by `fc.time`, with
`intensity` as the animatable knob. Per-position phase variation falls out of
the noise field for free, so no separate progress parameter. Note that the
scrolled fbm does **not** loop seamlessly over an arbitrary duration; a
`loopDuration` that phase-wraps the noise is a plausible follow-up, not v1.

## Padding derivation

```
top    = height + turbulenceReach + distortion
right  = spread + turbulenceReach + distortion
bottom = spread + turbulenceReach + distortion
left   = spread + turbulenceReach + distortion
```

all times `fc.pixelRatio`, then the pipeline rounds the region up to 32px
device buckets.

## Known limitations, documented

- A node inside a `Group` with a `clipFunc`, or a Sequence-level flameWrap at
  the stage edge, has its flames clipped: the padded region cannot exceed the
  surface being drawn into.
- Sequence-level application means a full-frame readback every frame. Docs
  recommend node-level.
- No GL platform means no flames (decision 3).

## Server rendering

Same code path. The renderer keeps providing its headless-gl platform through
`setCompositorFactory`, now imported from core; effects and transitions share
the one compositor instance. The chain is CPU-pinned per deviation 4. The
renderer's per-frame `ctx.reset()` discipline must cover the pooled capture
canvases and the SDF canvas, since both are long-lived and drawn plus read
every frame.

Prerequisite from the v2 doc, still required: `gl-node.ts` imports
`createRequire` from `node:module`, which demo and template vite configs alias
to a browser shim that also applies to the SSR graph, silently killing server
GL. It must become a bare `module` import with a lint guard.

## Testing

- `@smoove/effects` unit tests: param validation, fingerprint stability,
  padding derivation, chamfer SDF correctness against hand-computed small
  bitmaps (a filled square, a diagonal edge, a disjoint two-blob alpha).
- Core unit tests: pass coalescing order, per-side padding normalization and
  region math, dirty tracking including the translation carve-out.
- Dual-dialect compile test: the fragment compiles as `#version 300 es` and
  as its `transpileTo100` output.
- Determinism test: frame N rendered cold must be bit-identical to frame N
  reached by stepping forward from 0. This is what guards against accidental
  accumulated state.
- Renderer integration: render a short comp with flameWrap, assert frames are
  non-blank and hashes are stable across runs.
- No-platform test: with the compositor factory returning null, the pass is
  skipped, the node still draws, and the warning fires once.
- Browser/server parity on a fixed frame, tolerance-based.

## Repo chores

- Delete the stale untracked `packages/effects/` (`dist/` plus
  `tsconfig.tsbuildinfo` from the abandoned branch) before scaffolding the
  real package, so `tsc -b` cannot resolve leftover output.
- Add `@smoove/effects` to the `fixed` group in `.changeset/config.json`.
- Flag the one-time npm trusted-publisher registration for the maintainer in
  the PR (per `RELEASING.md`).
- Add a `packages/effects` row to the `AGENTS.md` layout table.
- Root and package `tsconfig` project references.
- A kitchen-sink registry entry demoing a burning title. Whoever writes that
  composition invokes the `smoove-video` skill first.

## Docs

- One docs page: what flameWrap does, the six taught params, the full
  reference table, node-level-not-Sequence-level guidance with the readback
  reasoning, the clip limitation, and the no-GL fallback stated plainly.
- `smoove-video` skill gains an effects section with the same guidance.
