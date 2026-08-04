# blur — design

A `blur` preset for `@smoove/effects`: one factory, two kernels. `gaussian` is
the near-free workhorse; `lens` is an optical defocus with blooming highlights
and a shaped aperture.

Date: 2026-08-04. Status: approved design, not yet planned.

## Background

### What blur means in film and in an NLE

Blurs split into two families. The ones with a physical cause read as footage:

| | cause | look |
| --- | --- | --- |
| defocus / lens blur / bokeh | subject off the focal plane | bright points become discs, or polygons from the aperture blades |
| motion blur | subject or camera moves during the shutter | a directional streak along the motion |
| zoom blur | focal length changes during the shutter | straight rays out of a centre |
| spin blur | camera rotates during the shutter | concentric arcs around a centre |

The ones with no physical cause read as an effect: gaussian, box and fast blur
(soft, characterless, cheap), mosaic (censorship), channel blur, compound blur
(a map drives radius per pixel), tilt-shift (a gradient does).

Every NLE ships about the same menu. After Effects: Gaussian, Camera Lens Blur,
Directional, Radial (spin and zoom), Box, CC Radial Fast Blur. DaVinci Resolve:
Gaussian, Box, Directional, Radial, Zoom, Mosaic, Lens Blur. Premiere: Gaussian,
Camera Blur, Directional.

### The detail that separates them

A Gaussian kernel falls off, so a bright specular gets dimmer as it spreads:
highlights die and the result looks like frosted glass. A real defocus kernel is
a flat disc, so a specular keeps its brightness and only grows. That is the
bokeh ball, and it is why cinematographers can tell the two apart instantly.

Every "cinematic blur" plugin is a disc convolution plus a highlight knee —
bright pixels weighted up before the convolution, normalized after — so the
blooms survive. It is about fifteen lines of shader and it is the entire
difference between "blurred" and "out of focus".

### Where smoove stands

`ctx.filter = "blur(Npx)"` is already free on both platforms: Skia implements
the CSS filter set natively and browsers run it on the GPU. `apply.ts` already
coalesces `css` passes into one `drawImage`, and a `css`-only chain keeps the
GPU rasterizer instead of being pinned to CPU. So a gaussian preset is almost no
code and inherits padding, pixelRatio correctness, dirty tracking and timeline
animation for free.

A lens blur needs a `shader` pass, which forces a readback.

`doc/effects-v2-design.md` sketched `blur({ radius })` as the css one-liner and
it was never built. Nothing in `@smoove/effects` blurs today. That doc also
described an `applyLayerEffects` Sequence path which does not exist either —
everything goes through per-node capture, and this design assumes only that.

## Goals

- A blur on any smoove node, in preview and in server renders, from one code path.
- The cheap case genuinely cheap: no readback, no CPU pin, no shader.
- The expensive case worth its cost: an optical defocus, not a bigger Gaussian.
- Room for `directional` and `radial` later without a new export or a rename.

## Non-goals

- Depth of field. A blur here is uniform over the node; "this layer is out of
  focus" is the use case, not "this part of the layer is".
- Mosaic, channel blur, compound blur, tilt-shift.
- A Sequence-level layer fast path. Worth building, but it is a pipeline change
  and belongs to its own spec.

## API

```ts
import { blur } from "@smoove/effects";

// the workhorse: one css pass, stays on the GPU
backdrop.effects([blur({ radius: 24 })]);

// the cinematic one: disc kernel, blooming highlights, 6-blade aperture
plate.effects([blur({ type: "lens", radius: 32, bloom: 0.7, blades: 6 })]);

// a focus pull is an animation like any other
const focus = blur({ type: "lens", radius: 40 });
title.effects([focus]);
seq.register((frame) => {
  focus.radius = interpolate(frame, [0, 24], [40, 0], { extrapolateRight: "clamp" });
});
```

| param | default | range | meaning |
| --- | --- | --- | --- |
| `type` | `"gaussian"` | `"gaussian" \| "lens"` | which kernel, and therefore which cost |
| `radius` | `8` | 0–200 CSS px | the blur circle. The same visual spread under either type |
| `bloom` | `0.5` | 0–1 | lens only. Highlight knee. 0 is a flat disc, 1 is full bokeh balls |
| `blades` | `0` | 0–12 | lens only. Aperture shape. Below 3 is a round aperture |
| `bladeAngle` | `0` | -360–360 deg | lens only. Orients a polygonal aperture |

### Why these choices

**`radius` is normalized across types.** A disc of radius *R* has standard
deviation *R*/2, so gaussian emits `blur((radius / 2) × pixelRatio)px` while
lens uses `radius` as the disc radius. Flipping `type` changes the character,
not the amount, and every docs example survives the switch.

**`bladeAngle`, not `angle`.** When `type: "directional"` lands, `angle` will
mean the streak direction. Taking that name now for the aperture would force a
rename later.

**`blades` below 3 is a round aperture, not an error.** Params clamp rather than
throw, and an `interpolate` sweeping `blades` through 0 must be safe.

**`bloom` and `blades` exist on a gaussian instance and do nothing.** A
discriminated options union would catch that at compile time, but it makes
`defineParams` and the live instance type awkward for a param you may want to
animate across a type flip. `chromaKey` has the same shape — a non-scalar
option (`color` there, `type` here) as a hand-written accessor that invalidates,
scalars through `defineParams`.

**`enabled()` is `radius > 0`,** so a zero-radius blur skips the capture
entirely and an unblurred node costs nothing. Same gate `flameWrap` uses on
`intensity`.

### Structure

One factory in `blur.ts`. `passes()` and `padding()` branch on `type`. The
alternative shapes were considered and rejected:

- Two factories (`blur` and `lensBlur`): no dead params, but the shared `radius`
  contract becomes a coincidence, the two stop being one idea, and comparing the
  looks means editing the call rather than a param.
- `bloom` as the implicit discriminator (`bloom: 0` takes the css path): elegant
  on paper, but it hides a roughly 20x cost cliff behind a param value, and
  animating `bloom` from 0 flips pass kinds mid-shot, changing the readback
  behaviour of the whole chain frame to frame.

## `type: "gaussian"`

One `css` pass:

```ts
{ kind: "css", filter: `blur(${(radius / 2) * fc.pixelRatio}px)` }
```

Padding is `2 × radius`, which is 4σ. At 3σ a Gaussian still sits at ~1.1% of
peak — against a bright node that is ~3/255 and reads as a faint rectangle at
the region boundary. 4σ is 0.03% and invisible.

The `× pixelRatio` is the easy thing to get wrong. `paramUniforms` scales
`px: true` params for shader uniforms automatically; a filter *string* has no
such help, so a missed multiply is a 1x preview that does not match a 2x render.
It gets its own test.

No `ctx.filter` fallback. Skia implements the CSS filter set natively, browsers
run it on the GPU, and Safari has had `ctx.filter` since 18. The v2 doc's Konva
stack-blur fallback is dead weight now.

## `type: "lens"`

One `shader` pass, `BLUR_LENS_FRAG`.

**Taps.** 48 on a golden-angle disc: `r = sqrt((i + 0.5) / 48)`,
`θ = (i + 0.5) × 2.39996 + jitter`. Uniform area coverage, constant loop bound
as GLSL ES 1.00 requires.

**Jitter is hashed from the position inside `contentRect`, not from
`gl_FragCoord`.** It breaks the 48 taps' spoke pattern into grain. Raw fragment
coords would also work, but the region origin is floored to whole device px, so
the grain would swim across the content as the node moves; anchoring to
`contentRect` pins it to the picture. It is a function of position only, so it
is frame-pure by construction.

**The knee** is the whole point of the preset:

```glsl
float luma = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
float w = 1.0 + u_bloom * 8.0 * pow(luma, 4.0);
```

Bright taps dominate the average, so a specular spreads into a disc that stays
bright instead of dimming into a smear. `bloom: 0` makes every `w` equal 1 and
gives a flat disc — a plain defocus, which is a useful setting rather than a
broken one.

The `8.0` gain and the `pow(luma, 4.0)` exponent are tuning constants, not
contract: they set how selective the knee is and how hard it pushes. Settle them
against the bloom pixel assertion below, then leave them alone. What is contract
is that `bloom: 0` is a flat disc and `bloom: 1` holds a small specular near its
source brightness.

**Alpha is not bloom-weighted.** Colour is `Σ(rgb·a·w) / Σ(a·w)`; alpha is the
plain disc average `Σa / 48`. Weighting alpha would fatten bright glyphs and
make highlights more opaque than their coverage.

This also means the pass needs no alpha raise before the straight-alpha divide,
unlike `flameWrap`. A weighted average is bounded by its largest input, so a
blur cannot produce a channel above what it read and the divide has nothing to
clip. Guard the divide on `acc.a > 0`.

**Blades** scale each tap's radius by the polygon boundary at its angle:

```
r *= cos(π/n) / cos(θ' - π/n),   θ' = θ - (2π/n)·floor(θ·n / 2π)
```

The `floor` form is deliberate: `%` and `mod` are both on the banned list.

**Uniforms** are the `paramUniforms` map plus `u_resolution`,
`u_contentOrigin`, `u_contentSize`, and `u_bladeAngle` converted to radians by
hand — `paramUniforms` only scales px. `u_blades` arrives as a float and the
shader compares `u_blades >= 3.0`; no int types, which the dialect bans.

**Padding is `radius + 2`.** A disc kernel has hard support at exactly `radius`;
the 2px covers tap jitter and the linear-filter half-texel.

**If 48 taps show spokes at a large radius**, the fix is `flameWrap`'s pattern:
a second variant off the same source with a `#define` spliced after the version
line, selected by a radius threshold in `passes()`. The compositor caches
programs by source so the two coexist. Both variants would need the dialect test
and the headless-gl compile, since a preprocessor branch is exactly what
compiles in one configuration and not the other. Not built upfront — the
big-shape pixel test decides.

## Cost

Cost is the padded region's area, not the node's. Gaussian at `radius: 24` on a
200x40 title pads the region to 296x136, about 5x the node's pixels — but it is
a native filter and the chain keeps the GPU rasterizer. Lens at `radius: 32`
reads 48 texels per region pixel and forces a readback, which pins the whole
chain to the CPU rasterizer on the server.

That difference is what the `type` param exists to make visible. Docs say: keep
the node's box tight, put the blur on the node rather than a Sequence, and reach
for `lens` when the look matters and `gaussian` when it does not.

Ordering follows the author's array, as always. Key before blur — blurring first
smears the key colour into the content. `blur` before `flameWrap` burns a
blurred node; after it, the fire itself blurs.

## Verification

1. `pnpm --filter @smoove/effects test` — params clamp on construction and on
   assignment (`radius = -5` → 0, `blades = 20` → 12); `enabled()` false at
   radius 0; pass kind by type; the filter string at pixelRatio 1 and 2
   (`radius: 24` must give `blur(12px)` and `blur(24px)`); padding per type;
   `u_bladeAngle` in radians and `u_radius` in device px; a param set
   invalidates the attached node.
2. `glsl/dialect.test.ts` — `BLUR_LENS_FRAG` joins the static banned-construct
   sweep and the uniform-name list.
3. `pnpm --filter @smoove/renderer test` — the real WebGL1 compile through
   headless-gl, the only proof the server path works, plus a frame-purity
   assertion. Blur has no time term at all so it should pass trivially, which is
   why it is worth writing down: it catches state creeping in later.
4. Pixel assertions:

   | check | method | catches |
   | --- | --- | --- |
   | isotropy | white dot, lens radius 20 — lit radius on-axis vs on the diagonal | a chamfer or anisotropic kernel |
   | containment | lit bbox must not touch the region edge, either type | insufficient padding |
   | the knee | small bright dot: peak at `bloom: 1` stays near the source's; at `bloom: 0` falls to roughly the area ratio | bloom silently doing nothing |
   | blades | `blades: 6` — radius at 6 angles 60° apart vs 6 offset by 30°, ratio ≈ `cos(π/6)` = 0.866 | a broken polygon term |
   | pixelRatio parity | same comp at 1x and 2x, downsample and compare | the missed `× pixelRatio` in the filter string |

5. A thin shape and a big shape: a title and a 300px card. Not cosmetic variants
   here — a card's interior has alpha 1 everywhere, so the premultiplied divide
   runs in a different regime than text, where nearly every tap straddles an
   alpha edge.
6. The browser, via the studio. headless-gl is WebGL1, so WebGL2 correctness
   exists nowhere else.
7. A server still and a short mp4.
8. Perf: warmup, flush with a 1x1 `getImageData`, min of several rounds, one
   effect-carrying `Composition` per process, against a no-effect baseline.
   Gaussian and lens reported separately.

## Files

```
packages/effects/src/blur.ts
packages/effects/src/glsl/blur-lens.frag.ts
packages/effects/src/blur.test.ts
packages/effects/src/glsl/dialect.test.ts        (+ entry)
packages/effects/src/index.ts                    (+ blur, Blur, BlurOptions, BlurType, BLUR_LENS_FRAG)
packages/renderer/src/blur.test.ts
packages/docs/content/docs/effects.mdx           (+ ## blur section)
packages/docs/src/demos/blur.ts
packages/kitchen-sink/src/compositions/blur/     (+ registry entry)
.changeset/<name>.md                             (patch — additive is patch while pre-1.0)
```

## Sources

- [Apply Blur and Sharpen effects in After Effects](https://helpx.adobe.com/after-effects/using/blur-sharpen-effects.html)
- [Every blur in DaVinci Resolve, and what each is for](https://www.storyblocks.com/resources/tutorials/how-to-blur-in-davinci-resolve)
- [Separable disk-like depth of field — Bart Wronski](https://bartwronski.com/2017/08/06/separable-bokeh/)
- [Efficiently Simulating the Bokeh of Polygonal Apertures in a Post-Process Depth of Field Shader](http://ivizlab.sfu.ca/papers/cgf2012.pdf)
- [Understanding Defocus and Bokeh](https://www.learnvfx.com/p/understanding-defocus-and-bokeh)
