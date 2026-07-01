# Animation

Everything is driven from `sequence.register((localFrame) => { ... })` —
read `localFrame`, compute a value, write it onto a Konva/smoove node with
its setter (`node.opacity(v)`, `node.x(v)`, `node.setAttr("flexGrow", v)`,
…). One function, called once per active frame, mutating properties
directly — every attribute must be a pure function of the frame (and any
`props`; see [sequencing.md](sequencing.md)).

**Never** reach for `setInterval`, `requestAnimationFrame`,
`Konva.Tween`/`Konva.Animation`, CSS transitions, or `Date.now()`/
`Math.random()` to drive a value. Only frame-derived values render
deterministically and can be scrubbed/seeked to an arbitrary frame or
rendered headlessly — a timer- or wall-clock-driven value can't be
reproduced at an arbitrary frame, so it silently breaks scrubbing and
offline rendering even though it looks fine during real-time playback.

```ts
// ✅ do
main.register((frame) => {
  box.x(interpolate(frame, [0, 30], [0, 400], { extrapolateRight: "clamp" }));
});

// 🚫 don't — invisible to scrubbing and to any headless/offline render
setInterval(() => box.x(box.x() + 4), 16);
```

## `interpolate`

API-compatible with Remotion's `interpolate`:

```ts
import { interpolate, Easing } from "@smoove/core";

const opacity = interpolate(
  localFrame,
  [0, 30],            // input range — must be strictly increasing
  [0, 1],              // output range — same length as input range
  {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",   // "extend" (default) | "identity" | "clamp" | "wrap"
    extrapolateRight: "clamp",
  },
);
```

Multi-segment ranges work too (e.g. fade in, hold, fade out):
`interpolate(localFrame, [0, 20, 80, 100], [0, 1, 1, 0])`.

Prefer `extrapolateLeft`/`extrapolateRight: "clamp"` over hand-clamping a
ratio — the intent ("hold at the ends") stays at the call site and the
easing curve is still applied correctly inside the range:

```ts
// ✅ do
interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

// 🚫 don't
Math.min(1, frame / 30);
```

## `Easing`

`Easing.linear | ease | quad | cubic | poly(n) | sin | circle | exp |
elastic(bounciness?) | back(s?) | bounce | bezier(x1,y1,x2,y2) | step0 |
step1`, each combinable with `Easing.in(fn)` (identity — `in` is a reserved
word so this is just the curve itself), `Easing.out(fn)`, `Easing.inOut(fn)`.
Typical pick: `Easing.inOut(Easing.cubic)` for a snappy ease, `Easing.out(Easing.cubic)`
for a settle-in entrance.

## `interpolateColors`

```ts
import { interpolateColors } from "@smoove/core";
const fill = interpolateColors(localFrame, [0, 60], ["#ff6b6b", "#4ea1ff"]);
```

Same input-range shape as `interpolate`; output is an array of color
strings interpolated channel-wise.

## Spring-style timing

Plain `@smoove/core` doesn't ship a spring primitive — `Easing.elastic`/
`Easing.back` cover most "bouncy" needs via `interpolate`. If you need an
actual physically-modeled spring (e.g. for a transition's progress curve),
`@smoove/transitions` exports `spring`/`springTiming` — see
[transitions.md](transitions.md).

## The one big gotcha: animating Flex/Block children

A `Flex`/`Block` re-places every child's `x`/`y`/`width`/`height` from its
own layout pass *after* your updater runs each tick (see
[layout.md](layout.md)). So:

- ✅ Safe on any node, flex child or not: `opacity()`, `scale()`,
  `rotation()`, `setAttr("flexGrow", …)`/`gap`/`padding` (on a Flex/Block).
- ✅ Safe on a **root** Flex/Block/shape (the node you `sequence.add()`'d
  directly, not nested inside another Flex/Block): `x()`, `y()`, `width()`.
- ❌ Animating `x()`/`y()` directly on a node that's a *child* of a
  Flex/Block gets silently overwritten every frame. For a "slide in" effect
  on a flex child, either lift it out of the flex container (give it
  explicit `x`/`y` and add it straight to the `Sequence`), or fake the slide
  with `offsetX`/`offsetY` + a non-animated flex position, or simply animate
  `opacity` instead (most title/card entrances only need a fade).

## Add a node before you animate it

`seq.add(node)` before setting attributes on it, not after. The `Sequence`
(a real Konva layer) is what actually paints — mutating a detached node's
attrs works silently but never repaints anything, which reads as "my
animation does nothing" with no error to point at.

## Reading composition-level state

`comp.props.get()` (typed props), `comp.frame.get()` (absolute frame, rarely
needed inside a sequence updater — prefer `localFrame`), `comp.fps`. Derive
durations as `n * fps` rather than hardcoding frame counts so a composition
stays correct if `fps` changes.
