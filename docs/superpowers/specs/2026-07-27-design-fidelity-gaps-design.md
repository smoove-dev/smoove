# Design fidelity gaps

**Date:** 2026-07-27
**Status:** Design, pending scope approval
**Origin:** Hand-porting a CSS design document into a smoove composition, and
recording every place the port needed arithmetic instead of an API call.

## Why this document exists

Designs arrive as CSS. Whether they come from a designer, a brief, or a model,
the source of truth is a stylesheet, and the port to smoove is a translation.
Every construct CSS has that `Block` does not becomes hand-derived geometry in
the composition file: an angle turned into two points, a stop list rebaked to
fake a second layer, a percentage radius turned into an SVG path.

Hand-derived geometry is not wrong. It is unreviewable. Nobody reading the
composition can tell whether `{ x: 0.933, y: -0.359 }` is the right vector for
`150deg`, and no test says so. The cost is not the arithmetic, it is that the
port becomes plausible rather than defensible.

This document lists what is missing, verified against the current source, and
proposes what closes it.

## Part A: fills

`Block.background` accepts `string | { gradient: { type, stops, angle } }`
([block.ts:15](../../../packages/core/src/layout/block.ts)). That is the whole
surface. Everything below is measured against it.

### A1. Angle gradients are present and wrong

`gradient.angle` exists, so it invites use, and it does not match CSS on either
axis.

The gradient length is `Math.max(w, h)`
([block.ts:224](../../../packages/core/src/layout/block.ts)). CSS uses the
projection of the box onto the gradient line, `|w·sinθ| + |h·cosθ|`, which is
what makes the first and last stops land exactly on the corners. On a
non-square box the two disagree, so the ramp reads compressed or stretched
against the design.

The angle origin also differs. `0` here points along positive x (to the right).
CSS `0deg` points to the top and increases clockwise. A design written as
`150deg` needs `angle: 60` under the current convention, and nothing in the
type says so.

Both are silent. The render looks like a gradient, just not that gradient.

### A2. One fill per shape

`linear-gradient(…), #FF2D3F` is two layers. A Konva shape has one fill, so the
port baked the upper ramp into the lower colour's stops. That is exact only
because both layers were opaque. A translucent overlay, a blend mode, or an
image layer forces a second node per element, and the layout tree grows a level
that exists for painting reasons only.

This is the general case of A3, A4, and A6 below. Repeating gradients, gradient
borders, and background images are all "more than one paint pass per box".

### A3. Repeating gradients

No expression. The streamer banding became a clipped `Group` holding a stack of
`Rect`s, with the stack length derived from the box size by hand.

### A4. Radial gradients have no geometry

The radial branch hard-codes a centred circle with
`endRadius = max(w, h) / 2`
([block.ts:230](../../../packages/core/src/layout/block.ts)). CSS defaults to a
`farthest-corner` ellipse, and design documents routinely write
`radial-gradient(circle at 30% 20%, …)` or `120% 80% at 50% 0%`.

No position, no shape, no size. Every glow ramp lands here, and the occasion
brief specifies glows as gradient ramps rather than baked blur, so this is
load-bearing for that catalog rather than theoretical.

### A5. Conic gradients

No expression at any level. `repeating-conic-gradient` (sunbursts, party
checkers, radial sweeps) is a custom `sceneFunc` each time.

### A6. Per-corner elliptical radii

CSS allows eight radii, `50% 50% 46% 46% / 54% 54% 48% 48%`, plus the
overflow rule that scales every radius by a common factor when adjacent radii
exceed an edge. `cornerRadius` is Konva's four circular radii. The balloon was
hand-derived into an SVG path, including the 1/1.02 scale factor.

### A7. Gradient text

`TextConfig.fill` is `string`
([types.ts:100](../../../packages/core/src/layout/text/types.ts)). Gradient type
is a premium-design staple (the awards brief asks for gold as a five-stop ramp,
which is a type treatment, not a background), and there is no path to it short
of a masked overlay or a custom `sceneFunc`.

### A8. Borders collapse

`borderColor` is typed per edge, and `applyBorder` reduces it to
`Math.max(...edges)` for width and `firstColor(color)` for colour
([block.ts:249](../../../packages/core/src/layout/block.ts)). So
`border-bottom: 2px solid` paints all four sides. Gradient borders have no
expression.

Konva's stroke is also centred on the path where a CSS border is inset, so a
4px border sits 2px outside the layout box that flex computed.

### A9. Shadows

One `ShadowProps`, no `spread`, no `inset`
([block.ts:25](../../../packages/core/src/layout/block.ts)). Design documents
stack two or three shadows as a matter of course. Konva's `shadowBlur` is also
not CSS's blur radius (CSS is roughly 2σ), so even a single shadow needs a
conversion the caller has to know.

### A10. Clipping

`Block` has no clip at all. A photo inside a rounded card, the most common card
pattern there is, needs a hand-written `clipFunc`. `Image` already ships one
([image.ts:113](../../../packages/core/src/layout/image.ts)), which is the
proof that the primitive belongs one level up.

### A11. Masks

`mask-image: linear-gradient(to bottom, #000, transparent)` for edge fades,
vignettes, and light-spill falloff. Needs `destination-in` compositing. No
primitive, so it is per-case.

### A12. Colour spaces

Design tooling increasingly emits `oklch()` and `color-mix()`. Browser canvas
parses those; the skia backend most likely does not. That produces a browser
and server divergence rather than an honest failure, which is the worst
failure mode available.

## Part B: API papercuts

Not fills, same root: the API forces work the caller should not be doing.

### B1. `Text` has no font size setter

The wrapper exposes `setText`, `setFill`, and `setFont`
([text.ts:207](../../../packages/core/src/layout/text/text.ts)). There is no
`setFontSize`. Fitting a long name to a plate therefore means destroying the
node and rebuilding it, and tracking the current size in composition-level
state because the node will not tell you.

The internals already do this: `_kmFit` calls `this._text.fontSize(fs)`
([text.ts:499](../../../packages/core/src/layout/text/text.ts)) and caches
`_resolvedFontSize`. The capability is there and unexposed.

### B2. `Image.cornerRadius` does not clamp

`normalizeCorners` passes radii straight through
([image.ts:247](../../../packages/core/src/layout/image.ts)) and `roundRectPath`
draws with them raw. CSS clamps to a common scale factor so radii can never
exceed the edge they share. `cornerRadius: 9999` on a square, the standard way
to ask for a disc, renders a squircle.

### B3. No seeded RNG

`Math.random` breaks frame purity and is correctly banned. Core ships no
replacement, so every composition hand-rolls a generator. Nine kitchen-sink
compositions currently do, each with its own constants, each unseeded from the
composition, so two runs of the same frame can differ across authors' code.

This is a ten-line function that every single composition needs.

## Part C: verification

Every claim in Part A and Part B above was established the same way: drive
`setFrame` from the browser console and read Konva state by hand.

That is the actual gap. When a spec says "168 elements on screen at 0.2s, 26 at
6.0s", that is an acceptance criterion, and today there is no way to write it as
a test that runs in CI.

The primitives are closer than they look:

- `Composition.setFrame` works headless. `packages/core/vitest.config.ts` loads
  `konva/skia-backend`, the same backend the renderer uses, so a composition
  constructed in vitest ticks for real.
- `measure(node, { at })` already drives a sequence to an arbitrary local frame
  without drawing, restores the live frame afterwards, and guards re-entrancy
  ([measure.ts:50](../../../packages/core/src/layout/measure.ts)). It calls
  `seq._kmRunFrame(at, false)`.
- `clip.test.ts:195` already calls `seq._kmRunFrame(5, false)` directly, which
  is an internal reaching into another internal because nothing public covers
  the case.

What is missing is the probe. Frame driving answers "advance the clock". It does
not answer "what is on screen now". Counting rendered elements, reading a
resolved fill, or asserting a node's painted position currently means walking
the Konva tree by hand and knowing which attributes are authoritative after
layout.

### What Part C needs

1. A documented way to construct a composition and step it in vitest, so the
   recipe is not folklore.
2. A probe that answers scene-graph questions at a frame: how many nodes match
   a selector and are actually visible, what is a node's stage-space box, what
   fill did it resolve to.
3. Both usable against real composition modules, not only against fixtures
   built inline in the test file.

Point 3 is the hard one. Kitchen-sink compositions are authored as modules that
expect the smoove Vite plugin, so loading one from vitest currently needs the
`ssrLoadModule` recipe plus a bootstrap in the module graph. Until that is
routine, tests can only cover synthetic scenes, and the thing under test stays
untested.

## Proposed shape

Three phases, in dependency order. Part C first, because it is what makes the
other two defensible rather than plausible.

**Phase 1: test harness.** Public frame driving plus scene probing, exported
from a test entry point. Small, no rendering changes, and every task after it
gets real tests.

**Phase 2: papercuts.** B1, B2, B3. Independent of each other, each one a test
plus a small change, each one an immediate unblock for composition authors.

**Phase 3: fills.** The Part A work, headed by a layered `background` that takes
an array of paint layers, plus clipping on `Block` so masks and rounded overflow
have somewhere to live. A2 is the theorem and A3, A4, A5, A7, A8, A11 are its
corollaries, so the layer model comes first and the individual gradient types
follow.

Phase 3 gets its own plan once Phase 1 lands, because its tests are written
against the harness Phase 1 builds.

## Open questions

1. Does the skia backend parse `oklch()` and `color-mix()`? A12 is a
   divergence risk, not a missing feature, and the answer changes whether it is
   a documentation fix or a colour-parsing layer.
2. Should the layered `background` model accept `Image` sources, or does that
   stay a separate node? Layering an image behind a gradient is common in the
   briefs, and folding it in means `Block` grows an asset-loading path.
3. Is CSS parity the goal, or CSS expressiveness? Parsing
   `linear-gradient(150deg, …)` from a string is a bigger commitment than
   offering an object form that can express the same thing. The plan assumes
   the object form.
