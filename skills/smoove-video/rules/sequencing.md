# Sequencing

`Composition` and `Sequence` from `@smoove/core`.

## Composition

```ts
const fps = 30;
const comp = new Composition({
  id: "my-scene",         // unique
  fps,
  durationInFrames: fps * 3, // duration in seconds, not a bare frame count
  width: 1280,
  height: 720,
  loop: true,             // optional — wrap to frame 0 instead of auto-pausing at the end
  props: { headline: "Hello" }, // optional — typed props, see below
});
```

`comp.durationInFrames` is a reactive signal (like `comp.frame`/`comp.props`)
— read it back with `comp.durationInFrames.get()` rather than hardcoding the
same number a second time somewhere else in the scene.

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
const main = new Sequence(); // spans the whole composition
comp.add(main); // or: main is added once, after children are attached
main.add(someNode); // a @smoove/core node — Rect, Text, Flex, Image, …
main.register((localFrame) => {
  // localFrame is 0-based within this sequence's own window
});
```

Both `Sequence` options default: `from` to `0`, and `durationInFrames` to the
composition's own duration. So `new Sequence()` (no arguments at all) is a
layer spanning the whole timeline, which is all a single-scene composition
needs. Pass `from` and
`durationInFrames` only when you want a partial window:

```ts
const outro = new Sequence({ from: 60, durationInFrames: 30 }); // frames 60 … 89
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

## Timeline markers — anchor cues to beats, not frame numbers

Never pin a cue (an SFX, a caption, an overlay) to a hand-computed frame
number when it belongs to a beat — retiming the beat silently desyncs it.
Give the scene a `name` and anchor to a marker instead:

```ts
const series = new Series()
  .add({ durationInFrames: 100, name: "intro" }, (seq) => seq.add(introNode))
  .add({ durationInFrames: 120, name: "code" }, (seq) => seq.add(codeNode))
  .add({ durationInFrames: 100, name: "outro" }, (seq) => seq.add(outroNode));

const code = series.marker("code"); // lazily-resolving handle, not a number

comp.add(series);
// A cue 10 frames before the beat:
comp.add(new Sequence({ from: code.start.add(-10), durationInFrames: 50 }).add(badge));
// A window from one beat until another (until replaces durationInFrames — never pass both):
comp.add(new Sequence({ from: code, until: series.marker("outro") }).add(bedNode));
```

A `Marker` has three points, each accepted anywhere `from`/`until` take a
number (a bare `Marker` means `.start`):

- `marker.start` — the scene's window opens (in a `TransitionSeries`: the
  incoming transition begins).
- `marker.end` — the window closes.
- `marker.settled` — start + incoming overlap (transition finished / overlap
  absorbed); equals `.start` for back-to-back scenes.
- `.add(n)` on any point returns a new point shifted by `n` frames.

Markers resolve live on every read, so retiming any earlier scene moves
everything anchored downstream. Standalone sequences chain the same way with
`sequence.marker()` (no name — a sequence is one scene):

```ts
const introSeq = new Sequence({ from: 0, durationInFrames: 60 });
const codeSeq = new Sequence({ from: introSeq.marker().end, durationInFrames: 90 });
```

A `Series`/`TransitionSeries` `from` also accepts a marker
(`new Series({ from: act1.marker("finale").settled })`), so whole acts chain.
Use `marker.resolve()` only for setup-time reads (e.g. placing a static
label); anchoring with an eagerly resolved number re-creates the desync bug
markers exist to fix. Scene names are unique per series (duplicates throw);
circular anchors throw instead of hanging.

## Plan the timeline first — declared markers

Markers can also be declared before any sequence exists, so the timeline is
planned up front and scenes fill the plan in. `plan()` lays out named beats
in one call; each key becomes a `Marker`:

```ts
import { Composition, Sequence, plan } from "@smoove/core";

const { intro, hero, outro } = plan({
  intro: { durationInFrames: 5 * fps },
  hero:  { durationInFrames: 10 * fps, offset: -10 }, // 10-frame overlap with intro
  outro: { durationInFrames: 5 * fps },
});

// The comp ends where the last beat ends. Retiming any beat retimes the comp.
const comp = new Composition({ id: "planned", fps, durationInFrames: outro.end, width, height });

comp.add(new Sequence({ span: intro }).add(introContent)); // spans exactly the beat
comp.add(new Sequence({ span: hero }).add(heroContent));
comp.add(new Sequence({ from: outro.start.add(-10), durationInFrames: 20 }).add(stinger));
```

- `span: marker` is sugar for `{ from: marker.start, until: marker.end }` and
  is mutually exclusive with `from`/`durationInFrames`/`until`.
- `offset` on a step shifts it off the previous beat's end, same semantics as
  `Series` (negative overlaps, positive gaps; an overlapped beat's `settled`
  is `start + |offset|`).
- Single markers can be declared directly and chained by anchor:
  `new Marker({ start: intro.end, durationInFrames: 90 })` (or `until:`
  instead of `durationInFrames`). `plan()` is just this, chained for you.
- Declared and derived markers interoperate: a plan can start at a series
  beat (`plan(steps, { from: series.marker("code").end })`) and a `Series`
  can start at a declared beat.
- To size a beat from a real clip, probe the file first: see "Know a clip's
  length up front" in [media.md](media.md).

## `konva` — one copy only

`konva` is a peer dependency; `Composition extends Konva.Stage` and every
core wrapper extends a Konva class, so two copies of `konva` in the
dependency tree break `instanceof` checks and layout (a node from one copy
isn't recognized by code holding the other). Within this monorepo pnpm's
workspace resolution already dedupes it; if you're consuming `@smoove/core`
from a separate app, make sure your bundler/package manager dedupes `konva`
to a single version too.
