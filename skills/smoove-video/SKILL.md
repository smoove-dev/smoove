---
name: smoove-video
description: Use when creating, animating, or laying out a smoove (Konva-based) video Composition or Sequence — timeline-driven scenes, Flex/Block layout, interpolate-based animation, or Text/shape authoring.
metadata:
  tags: smoove, konva, video, animation, composition, motion
---

## When to use

Any time you're authoring or editing smoove (`@smoove/*`) composition code — a
new scene, an animated layout, text, shapes, or media. Out of scope: running
or previewing a composition (`@smoove/player`, the Studio) and rendering to
MP4/stills (`@smoove/renderer`) — this skill only covers writing the
`composition.ts` code itself.

## Mental model

`Composition extends Konva.Stage` and owns the frame clock (`fps` +
`durationInFrames`). `Sequence extends Konva.Layer` is range-gated — visible
and ticked only while the playhead is in `[from, from + durationInFrames)`.
Each frame, every active sequence runs its registered updaters, then
re-flows any `Flex`/`Block` layout, then draws. You animate by mutating Konva
node properties inside `sequence.register((localFrame) => { ... })` —
**imperative, per-frame, pull-based, and a pure function of the frame**. No
CSS transitions/keyframes, no React, no `setInterval`/`requestAnimationFrame`/
`Konva.Tween`, no `Date.now()`/`Math.random()` (core ships a seeded
`random(seed)` for scatter) — anything not derived from `frame` (and `props`)
breaks scrubbing and headless rendering even though it looks fine during
real-time playback. `@smoove/core`
re-exports the whole drawing vocabulary (`Rect`, `Circle`, `Text`, `Image`,
…) — **import shapes and nodes from `@smoove/core`, not `Konva.*` directly**;
reach for raw Konva only for something core doesn't wrap (see
[rules/shapes.md](rules/shapes.md)).

## Create a composition

A composition is a single module that default-exports a `Composition` built
from `@smoove/core` primitives — no other wiring required:

```ts
import { Circle, Composition, Rect, Sequence } from "@smoove/core";

const width = 1280;
const height = 720;
const fps = 30;
const comp = new Composition({ id: "my-scene", fps, durationInFrames: fps * 3, width, height });

const main = new Sequence(); // spans the whole composition — no options needed
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
const circle = new Circle({ x: 100, y: height / 2, radius: 60, fill: "#4ea1ff" });
main.add(circle);
comp.add(main);

main.register((frame) => {
  const total = comp.durationInFrames.get();
  circle.x(100 + frame * ((width - 200) / total));
});

export default comp;
```

## Sequence scenes & anchor cues

`Series` lays scenes back-to-back and computes each `Sequence`'s `from`. Give
scenes a `name` and anchor cues (SFX, captions, overlays) to **timeline
markers** instead of frame numbers: `new Sequence({ from:
series.marker("code").start.add(-10) })` moves with the beat when scenes are
retimed, and `until:` spans one beat to another. Never hand-pin a cue's frame
to a number derived from other scenes' durations. Details:
[rules/sequencing.md](rules/sequencing.md).

## Animate

`interpolate(frame, inputRange, outputRange, { easing, extrapolateLeft,
extrapolateRight })` + `Easing` (`Easing.in/out/inOut(Easing.cubic|quad|...)`,
`Easing.bezier(...)`, `Easing.spring`-style timings live in
`@smoove/transitions`). **Gotcha:** a `Flex`/`Block` child's `x()`/`y()`/
`width()`/`height()` are overwritten every tick by the layout pass that runs
*after* updaters — animate `opacity()`, `scale()`, `rotation()`, or flex
props (`flexGrow`, `gap`, `padding`, `alignSelf`) instead. Details: [rules/animation.md](rules/animation.md).

## Components & nested timelines

`Clip` is a range-gated, tickable `Group`: `Sequence` semantics without the
per-layer canvas, nestable to any depth. A shareable component is a plain
function that builds a `Clip`, registers an updater, and returns it:

```ts
export function pulseDot({ size, ...clipOpts }: Props): Clip {
  const clip = new Clip(clipOpts); // from/durationInFrames + any GroupConfig
  clip.add(new Circle({ /* geometry in a fixed unit box, scaled by size */ }));
  clip.register((frame, { time }) => { /* seconds via info.time = fps-portable */ });
  return clip;
}
seq.add(pulseDot({ size: 120, x: 400, y: 300, from: 60 }));
```

Every updater (on `Sequence` and `Clip`) receives `(frame, info)` with
`info = { time, fps, durationInFrames, globalFrame }`. Every smoove node has
`getComposition()`/`getSequence()`/`getClip()`, and `Composition`/`Sequence`/
`Clip` expose cached `query()`/`queryOne()` (Konva selectors: `#id`, `.name`,
`TypeName`), cheap to call every frame (e.g. duck the `#music` audio from a
voice-over updater). Keep `Audio`/`Video` directly in a `Sequence` for now.
Details: [rules/components.md](rules/components.md).

## Layout

Drop `Flex`/`Block` into a sequence for CSS-flexbox-like auto layout
(`flexDirection`, `justifyContent`, `alignItems`, `gap`, `padding`,
gradients/shadows/borders/`cornerRadius` on `Block`). Reflow is automatic —
no manual wiring. Details: [rules/layout.md](rules/layout.md).

## Text & fonts

`Text` (extends `Konva.Group`, not `Konva.Text` — use `.setText()` for content
and `.setFontSize()` for size) supports `fitText`, `maxLines`/`ellipsis`, a
built-in `typewriter` reveal, and `highlights`. `.fontSize()` reads back the
size the glyphs actually render at, which is the fitted one under `fitText`.
Details: [rules/text.md](rules/text.md) and,
for installable Google Fonts, [rules/fonts.md](rules/fonts.md).

## Media

`Image` comes from `@smoove/core`; `Audio`/`Video` ship in `@smoove/media`
(add it as a dependency). Passing `introspect` to `Audio` turns the clip's
real sound into frame-pure signals — `rmsAt`/`peakAt`/`bandsAt`/`noveltyAt`/
`waveform` — for meters, EQ bars, waveforms, and beat-synced motion that
scrub and server-render deterministically. Details: [rules/media.md](rules/media.md).

## Performance

An animated scene is a full-canvas repaint every frame. **Never `shadowBlur`
in an animated scene** — canvas shadow blur re-runs per shape per frame and
profiles as the dominant cost (choppy on retina/mobile). Fake glows instead:
radial-gradient fills for dots/orbs, a wide faint under-stroke for lines, a
gradient disc behind sharp shapes for halos. Use 30fps for ambient/background
motion. Recipes + the scale-not-radius gotcha:
[rules/performance.md](rules/performance.md).

## Verify what you built

When a brief carries numbers ("the title lands by 0.5s", "six cards at the
end"), assert them instead of eyeballing a preview. `@smoove/core/testing`
drives the clock and reports what is on screen, headless:

```ts
import { countAt, probeAt } from "@smoove/core/testing";

await comp.whenReady();
probeAt(comp, { time: 0.5 }, ".title")[0]?.box.y; // stage-space, at that frame
countAt(comp, { time: 6.0 }, ".card"); // how many actually paint
```

Details: [rules/testing.md](rules/testing.md).

## Effects (optional)

`@smoove/effects` post-processes a node as it draws. `flameWrap` wraps fire
around a node — its rounded box by default, or its alpha edge with
`shape: "silhouette"` so a burning `Text` burns letter by letter:

```ts
import { flameWrap } from "@smoove/effects";

const fire = flameWrap({ radius: 40, intensity: 0 }); // match your cornerRadius
card.effects([fire]);
seq.register((frame) => {
  fire.intensity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp" });
});
```

Three rules. `intensity: 0` disables the effect, so animate it from 0 to
ignite. Put the effect on the node you want burning, never on the `Sequence`,
because cost tracks the area being shaded. Keep that node's box near its
content: a centred `Text` with `width: 1280` makes the effect shade the whole
frame, so give it a width close to the glyphs and centre it with `x`.
`flameWrap` needs WebGL; where there is none the fire is skipped and the node
draws normally.

`droplets` puts rain on a pane of glass in front of a node, and inverts the
box rule: it refracts what is behind it, so its node is meant to hold a scene
(a `Video`, an `Image`, a `Group` with a whole layout), and it never paints
outside that node's alpha. Animate `intensity` for a squall; move `blur` with
it to fog the window up and clear it again.

```ts
import { droplets } from "@smoove/effects";

const rain = droplets({ intensity: 0, vignette: 0.5 });
pane.effects([rain]);
seq.register((frame) => {
  rain.intensity = interpolate(frame, [0, 60], [0, 1.15], { extrapolateLeft: "clamp" });
  rain.blur = 2 + rain.intensity * 4;
});
```

## Optional add-ons

- `@smoove/transitions` — `TransitionSeries` + presentations (fade, slide,
  wipe, dissolve, …) for scene-to-scene cuts. [rules/transitions.md](rules/transitions.md)
- `@smoove/google-fonts` — typed per-family classes (`import Roboto from
  "@smoove/google-fonts/roboto"`) for `Text`'s `font` prop. [rules/fonts.md](rules/fonts.md)

## Topic index

[sequencing](rules/sequencing.md) · [components](rules/components.md) ·
[layout](rules/layout.md) ·
[animation](rules/animation.md) · [text](rules/text.md) ·
[shapes](rules/shapes.md) · [media](rules/media.md) ·
[performance](rules/performance.md) · [testing](rules/testing.md) ·
[transitions](rules/transitions.md) (optional) · [fonts](rules/fonts.md)
(optional)
