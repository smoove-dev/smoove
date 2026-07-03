# Sequencing

`Composition` and `Sequence` from `@smoove/core`.

## Composition

```ts
const comp = new Composition({
  id: "my-scene",         // unique
  fps: 30,
  durationInFrames: 90,   // total length in frames (90 @ 30fps = 3s)
  width: 1280,
  height: 720,
  loop: true,             // optional — wrap to frame 0 instead of auto-pausing at the end
  props: { headline: "Hello" }, // optional — typed props, see below
});
```

`Composition extends Konva.Stage`. Build the scene graph once at module load
(everything below `comp` is plain Konva + smoove nodes), then animate by
registering per-frame updaters — never recreate nodes inside an updater.

**Keep the composition pure.** Every node's attributes should be derivable
from `frame` and `props` alone — no external mutable state, no `Date.now()`,
no `Math.random()` (seed randomness from the frame or a fixed seed instead).
This is what makes scrubbing and repeated/headless rendering produce
identical output; an impure updater looks fine during a single real-time
playback and then desyncs the moment you seek or re-render.

Typed props: `new Composition<MyProps>({ props: defaults })` exposes
`comp.props.get()` (read live in an updater) and `comp.setProps(next)` for a
host application to push updates into a running composition. **Pass a new
object rather than mutating the previous one** — `setProps` compares by
reference and skips the re-render when it's unchanged, so mutating
`comp.props.get()` in place and calling `setProps` with the same reference
is a silent no-op. Only add props if the scene genuinely needs external
parameters — a plain composition doesn't need the generic.

`play()` needs `requestAnimationFrame` and only works in a browser;
`comp.setFrame(n)` works anywhere (Node included) and is what any offline or
headless path steps frames with — reach for it whenever you need to render a
specific frame without a running rAF loop.

## Sequence

```ts
const main = new Sequence({ from: 0, durationInFrames: 90 });
comp.add(main); // or: main is added once, after children are attached
main.add(someNode); // a @smoove/core node — Rect, Text, Flex, Image, …
main.register((localFrame) => {
  // localFrame is 0-based within this sequence's own window
});
```

`Sequence extends Konva.Layer` — a real Konva layer, so it has its own
canvas. It is `visible(false)` and inert outside `[from, from +
durationInFrames)`; once the playhead enters that range it becomes visible,
runs every registered updater with `localFrame = frame - from`, re-flows any
top-level `Flex`/`Block` children, and draws. Use multiple sequences to
stage non-overlapping or overlapping scenes (a title sequence at `[0, 60)`,
a body sequence at `[30, 120)`, etc.) — each gets its own visibility window
and its own `register()` callbacks.

`register()` returns an unregister function; you rarely need to call it for
a sequence's whole lifetime, but it's there if you build dynamic updaters.

`seq.add(node)` a node before setting attributes on it, not after — the
`Sequence` is what actually paints, so mutating a still-detached node's
attrs updates them silently but never repaints anything.

## Series — auto-sequenced scenes

For scenes that play back-to-back (or with a fixed gap/overlap), `Series`
computes each scene's `from` for you instead of hand-adding frame counts:

```ts
import { Series } from "@smoove/core";

const series = new Series({ from: 0 })
  .add({ durationInFrames: 60 }, (seq) => seq.add(introNode))
  .add({ durationInFrames: 90, offset: -10 }, (seq) => seq.add(bodyNode)); // 10-frame overlap

comp.add(series); // Composition.add accepts a SequenceProvider directly
series.durationInFrames; // total span, accounting for offsets
```

`offset` on a scene shifts it relative to the previous scene's end: `0`
(default) is back-to-back, negative overlaps, positive leaves a gap. A
negative `offset` may not push a scene's `from` below the series' own `from`
(or below `0`) — `Series` throws rather than silently clamping it.

## `konva` — one copy only

`konva` is a peer dependency; `Composition extends Konva.Stage` and every
core wrapper extends a Konva class, so two copies of `konva` in the
dependency tree break `instanceof` checks and layout (a node from one copy
isn't recognized by code holding the other). Within this monorepo pnpm's
workspace resolution already dedupes it; if you're consuming `@smoove/core`
from a separate app, make sure your bundler/package manager dedupes `konva`
to a single version too.
