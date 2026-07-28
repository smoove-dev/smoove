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

## Scatter: `random(seed)`, not `Math.random()`

Confetti, starfields, jitter, and any other "scattered" look need randomness
that survives a seek. Core ships a seeded generator, so don't hand-roll one:

```ts
import { random } from "@smoove/core";

const r = random("confetti"); // number or string seed
const dots = Array.from({ length: 80 }, () => ({
  x: r.range(0, width),        // float in [min, max)
  y: r.range(0, height),
  size: r.int(2, 6),           // integer, both ends inclusive
  tint: r.pick(["#ff2d3f", "#ffc53d", "#4ea1ff"]),
}));
```

The same seed always walks the same sequence, in the browser and on the
server. **Gotcha:** a generator is stateful, so it moves as you call it. Seed
it at module scope and read the values into an array once, as above. A
generator advanced *inside* an updater hands out different numbers on a seek
than it did on playback, which is the exact bug the seed is there to prevent.

## Stepped values: quantize the frame, don't skip frames

A subtler purity leak: updating a node only on every Nth frame
(`if (frame % 10 === 0) { … }`) leaves stale state — a seek to frame 13 shows
whatever the node held at the last *painted* frame, not what playback would
show. Same for keeping decaying state between frames (a "falling" meter cap
that subtracts a bit each call). To make a value move in steps or hold, stay
a pure function of the frame: quantize it, or take a max over a trailing
window, and compute **every** frame.

```ts
// ✅ stepped needle, pure — a seek to any frame shows the same reading
const stepped = frame - (frame % 10);
needle.x(meterX(music.peakAt(stepped, { holdFrames: 10 })));

// 🚫 stale on seek/scrub — skipped frames keep the previous value
if (frame % 10 === 0) needle.x(meterX(music.peakAt(frame)));
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
