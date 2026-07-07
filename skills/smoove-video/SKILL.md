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
`Konva.Tween`, no `Date.now()`/`Math.random()` — anything not derived from
`frame` (and `props`) breaks scrubbing and headless rendering even though it
looks fine during real-time playback. `@smoove/core`
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

## Animate

`interpolate(frame, inputRange, outputRange, { easing, extrapolateLeft,
extrapolateRight })` + `Easing` (`Easing.in/out/inOut(Easing.cubic|quad|...)`,
`Easing.bezier(...)`, `Easing.spring`-style timings live in
`@smoove/transitions`). **Gotcha:** a `Flex`/`Block` child's `x()`/`y()`/
`width()`/`height()` are overwritten every tick by the layout pass that runs
*after* updaters — animate `opacity()`, `scale()`, `rotation()`, or flex
props (`flexGrow`, `gap`, `padding`, `alignSelf`) instead. Details: [rules/animation.md](rules/animation.md).

## Layout

Drop `Flex`/`Block` into a sequence for CSS-flexbox-like auto layout
(`flexDirection`, `justifyContent`, `alignItems`, `gap`, `padding`,
gradients/shadows/borders/`cornerRadius` on `Block`). Reflow is automatic —
no manual wiring. Details: [rules/layout.md](rules/layout.md).

## Text & fonts

`Text` (extends `Konva.Group`, not `Konva.Text` — use `.setText()` to change
content) supports `fitText`, `maxLines`/`ellipsis`, a built-in `typewriter`
reveal, and `highlights`. Details: [rules/text.md](rules/text.md) and,
for installable Google Fonts, [rules/fonts.md](rules/fonts.md).

## Effects

Any node, group, or `Sequence` accepts `effects: [...]` with presets from
`@smoove/effects`: `blur({ radius })`, `chromaKey({ color, similarity,
smoothness })` (green screen), `shine({ angle, width, intensity, progress })`
(highlight sweep — animate `progress` 0→1), and `water({ waves, caustic,
speed })` (shader distortion; needs WebGL2 / server `gl` package, skipped
gracefully otherwise). Params are plain properties — assign them in an
updater (`fx.radius = interpolate(...)`). Rules: key BEFORE blur
(`[chromaKey(), blur()]`, never the reverse); when several nodes share one
look, put the effect on the `Sequence` (`seq.effects([...])`) — one layer
pass instead of per-node captures.

## Optional add-ons

- `@smoove/effects` — blur, chromaKey, shine, and water presets for the
  `effects: [...]` config (see Effects above).
- `@smoove/transitions` — `TransitionSeries` + presentations (fade, slide,
  wipe, dissolve, …) for scene-to-scene cuts. [rules/transitions.md](rules/transitions.md)
- `@smoove/google-fonts` — typed per-family classes (`import Roboto from
  "@smoove/google-fonts/roboto"`) for `Text`'s `font` prop. [rules/fonts.md](rules/fonts.md)

## Topic index

[sequencing](rules/sequencing.md) · [layout](rules/layout.md) ·
[animation](rules/animation.md) · [text](rules/text.md) ·
[shapes](rules/shapes.md) · [media](rules/media.md) ·
[transitions](rules/transitions.md) (optional) · [fonts](rules/fonts.md)
(optional)
