---
name: smoove-effects
description: Use when adding or changing an effect in @smoove/effects, or touching the effects pipeline in core/src/effects - a new post-process preset, a fragment shader for one, distance-field work, or debugging an effect that looks wrong, renders blank in an mp4, or tanks the frame rate.
metadata:
  tags: smoove, effects, shader, glsl, webgl, sdf, post-process, performance
---

## When to use

Writing a new preset for `@smoove/effects`, changing `flameWrap` or `droplets`,
or working on the pipeline in `core/src/effects/`. Not for authoring compositions (that is
`smoove-video`) or for using an existing effect, which is one line:
`node.effects([flameWrap()])`.

## Mental model

An effect is a post-process on a node's own drawing. Each frame the pipeline
captures the node into a pooled canvas, runs the effect's passes over those
pixels, and blits the result back where the node would have drawn. The effect
never sees the scene, only its own node plus whatever padding it asked for.

Every rule below exists because it was broken once and the bug is described.

## Anatomy

```
packages/effects/src/
  <name>.ts               the factory: params, padding, passes
  glsl/<name>.frag.ts     fragment source as a template string
  params.ts               shared: defineParams (clamping accessors), validateColor,
                          Attachments. Every helper takes the effect's name for
                          its error messages, so nothing is hardcoded to one preset
  sdf.ts                  exact euclidean distance fields + per-node cache
  index.ts                barrel: export the factory and its options type
```

Registration: barrel export, `.changeset/config.json` `fixed` group if the
package is new, a docs page, and a kitchen-sink demo.

## The contract

`SmooveEffect` returns passes per frame. Four kinds:

| kind | what it is | cost note |
| --- | --- | --- |
| `css` | a `ctx.filter` fragment | consecutive ones merge into one string |
| `pixels` | typed-array pass | forces a readback, pins the chain to CPU |
| `composite` | draws on the working canvas | cheapest, no pixel access |
| `shader` | fragment through the shared GL bridge | forces a readback too |

`padding(fc)` returns CSS px, scalar or `{top,right,bottom,left}`. Use per-side
whenever the effect is directional.

`enabled()` returning false skips the capture entirely, so gate on your
intensity param and an unlit node costs nothing.

`fc.contentRect` is the node's own box inside the captured region, device px,
y-down. An effect that shapes itself analytically needs it: the region is the box
plus padding snapped to a bucket, so the box cannot be recovered from
`fc.width`/`fc.height`.

**Shader passes emit straight alpha.** The server reads the framebuffer with
`readPixels` into an ImageData, whose channels are not premultiplied, and the
browser compositor is created with `premultipliedAlpha: false` to match. A shader
that composites premultiplied (most fire and glow maths does, because additive
light does not raise coverage) has to divide out at the end — and raise alpha to
carry anything brighter than its own coverage, or the divide clips the glow.

## Five rules

**1. Frame purity is the whole design.** Read time only from `fc.time`
(`frame / fps`). No accumulated state, no wall clock, no counters that advance
per call. Particles and sparks get a hashed phase so position is a closed-form
function of time. The test: frame N rendered cold must equal frame N reached by
stepping from 0. If that fails, find the state and remove it.

**2. Author GLSL in the 1.00-safe subset.** `transpileTo100` is a short list of
string rewrites, not a GLSL parser, and the server runs headless-gl (WebGL1
only). Read it before you write a shader; it is 20 lines. Banned:
`floatBitsToUint`, `uint`/`uvec`, bit shifts, `^ & |`, `%`, `round`, `trunc`,
`switch`, `textureLod`, `inverse`, non-constant loop bounds. Hash with
`fract(sin(dot(p, k)) * m)`. Guard it two ways: a static regex test in
`glsl/dialect.test.ts` and a real compile through headless-gl in
`@smoove/renderer`. The static test will miss things; the compile will not.

**3. Cost is the padded region's area.** Not the node, the region. Padding of
170px on a small title triples the pixels shaded. Keep bands as narrow as the
look allows, prefer per-side padding, and tell users to keep the node's own box
tight and to put the effect on a node rather than a Sequence.

**4. Cache anything derived, keyed on `fc.contentVersion`.** Build it on a
CPU-pinned surface via `createCpuCanvas`, never the pooled working canvas:
reading back a GPU-rasterized skia canvas corrupts. `fc.contentVersion` holds
steady while the node's pixels do, including while it moves.

**5. Know your field's range.** The distance field packs a near channel
(±16px, fine) and a far channel (±256px, coarse). A band wider than a channel's
range cannot fall off inside a large shape, because the value saturates. Use
near for melt and rim, far for anything reaching further. It is only built for
shapes that need it: `flameWrap` derives nothing per frame in its default `box`
shape, and pays for the field only under `shape: "silhouette"`.

**Shape variants are one source and a `#define`.** `flameWrap` exports
`FLAME_WRAP_FRAG` and `FLAME_WRAP_SILHOUETTE_FRAG` from the same string, the
second with `#define SHAPE_SILHOUETTE 1` spliced after the version line. The
compositor caches programs by source, so the two coexist, and the box program
never declares the sampler it would not read. Both variants must go through the
dialect test and the headless-gl compile: a preprocessor branch is exactly the
thing that compiles in one configuration and not the other.

## Verify

Four checks, in order. Skipping any one of them has shipped a bug.

1. `pnpm --filter @smoove/effects test` for param and field math.
2. `pnpm --filter @smoove/renderer test` for the real WebGL1 compile plus a
   frame-purity assertion. This is the only proof the server path works.
3. The browser, via the studio. headless-gl is WebGL1, so WebGL2 correctness
   exists nowhere else.
4. A server still or short mp4. "Effects missing from server mp4s" has happened
   in this repo more than once.

**Test on a thin shape and a big shape.** This catches more than anything else
here. A burning letter and a burning card exercise different paths: every part
of a glyph is within a few px of an edge, a card's middle is 160px from one. Two
separate bugs were invisible on one shape and glaring on the other.

**Check pixels, not vibes.** Assert numerically: the lit bounding box (does the
effect leak to the region edge?), per-row counts of large luminance jumps (is
there a seam?), a radius measured along an axis versus a diagonal (is the field
isotropic?).

**Measure with warmup and min-of-rounds, one config per process.** Single runs
here produced "no effects" timing slower than the effect. Warm first so a cold
cache build does not land in the window, flush with a 1x1 `getImageData`, take
the minimum of several rounds, and compare against a no-effect baseline. Build
only one effect-carrying `Composition` per process: successive ones in the same
process get several times slower each, which reads as "this parameter is
expensive" when it is only "this comp was built fourth". A 13-tap blur measured
as 10x its true cost that way, and as free once measured on its own.

## Traps

| Symptom | Cause |
| --- | --- |
| Build fails, `',' expected` in a .frag.ts | A backtick inside the GLSL, closing the template literal. Never use backticks in shader comments. |
| Effect renders blank on the server | No GL platform injected, or a WebGL2-only construct. Check the compile test. |
| Frame rate collapses on a Block or Flex node | Derived data rebuilt every frame. Layout and drawing writes are suppressed by `withDerivedWrites`; if you add a new write path, suppress it too. |
| A large shape is uniformly tinted or charred | A band measured against the near channel that is wider than 16px. |
| Hard straight edges at 45 degrees | A chamfer distance metric. Use the exact euclidean transform in `sdf.ts`. |
| A visible rectangle around the node | A term that has not decayed by the region boundary. Window everything the effect adds to zero at the edge. |
| The node grows a margin, or its box shifts | Working in region uv. The region is the box plus padding **snapped up to a 32px bucket**, so with zero padding it is still bigger than the node. Place the effect from `fc.contentRect` and leave everything outside it untouched. |
| A translucent hairline around the node, or a dark bite where the effect displaces content across its edge | Sampling `u_tex0` at the box boundary. LINEAR blends the last content texel with the first transparent one there, so clamp reads half a texel inside the box. |
| Need a mip blur | `textureLod` is banned and there is no mip chain. Use a fixed-count tap disc, accumulated premultiplied so it does not drag colour across an alpha edge. |
| Scrubbing differs from playback | Accumulated state. See rule 1. |

## Checklist

- [ ] Params clamp rather than throw, so an easing overshoot is safe
- [ ] `enabled()` false when the effect would be invisible
- [ ] Per-side padding derived from the params that actually reach
- [ ] Time only from `fc.time`
- [ ] Fragment passes the dialect test and the headless-gl compile
- [ ] Derived data cached on `fc.contentVersion`, built CPU-pinned
- [ ] Verified on a thin shape and a big shape, in browser and in a render
- [ ] Docs page, kitchen-sink demo, changeset
