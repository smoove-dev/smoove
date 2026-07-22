# Components & nested timelines (`Clip`)

`Clip` is a range-gated, tickable timeline that extends `Group`: `Sequence`
semantics without the per-layer canvas. Drop one anywhere inside a `Sequence`
(or another `Clip`, any depth) and it is visible and ticked only while the
parent timeline's playhead is inside `[from, from + durationInFrames)`. Its
updaters receive clip-local frames.

```ts
import { Clip } from "@smoove/core";

const intro = new Clip({ from: 30, durationInFrames: 90, x: 100, y: 100 });
intro.register((frame, info) => {
  // frame is clip-local: 0 on the clip's first visible frame
});
seq.add(intro);
```

Options mirror `Sequence`: `from`, `durationInFrames`, `until`, `span`, plus
any `GroupConfig`. `from`/`until` take parent-local frame numbers, or
`Marker` points (markers are always absolute and get re-based onto the
parent). Duration defaults to the remainder of the parent timeline.
`clip.marker()` works like `sequence.marker()` and resolves through the
parent chain, so other scenes can anchor to a point inside a clip.

Konva's masking props (`clip`, `clipFunc`) keep their Konva meaning and work
on a `Clip` unchanged.

## The updater payload

Every `register` updater, on `Sequence` and `Clip` alike, receives a second
argument:

```ts
seq.register((frame, { time, fps, durationInFrames, globalFrame }) => {
  // time:   local seconds (frame / fps)
  // fps:    the host composition's fps
  // durationInFrames: this timeline's own span
  // globalFrame: the absolute composition frame
});
```

One-argument updaters keep working; `frame` is unchanged as the first
argument.

## Writing a shareable component

A component is a plain function that builds a `Clip`, registers an updater,
and returns it. No classes, no engine hooks.

```ts
export function pulseDot({ size, ...clipOpts }: PulseDotProps): Clip {
  const clip = new Clip(clipOpts);
  const dot = new Circle({ x: size / 2, y: size / 2, radius: size / 8, fill: "#FFC23C" });
  clip.add(dot);
  clip.register((_frame, { time }) => {
    const s = 1 + 0.2 * Math.sin(time * Math.PI * 2);
    dot.scaleX(s);
    dot.scaleY(s);
  });
  return clip;
}

// consumer: mount it anywhere, at any depth
seq.add(pulseDot({ size: 120, x: 400, y: 300, from: 60 }));
```

Conventions that make a component play the same in any composition:

- Author geometry in a fixed unit box (say 100 units) and scale the clip by a
  `size` prop, so proportions are identical at any size.
- Author timing in seconds via `info.time`, not frames, so the motion is
  identical at any fps.
- Keep the updater a pure function of the frame, like all smoove animation.
- Take `ClipOptions` in the props and spread them into the `Clip`, so the
  consumer controls placement and range (`from`, `durationInFrames`).

Reference implementation: `packages/kitchen-sink/src/compositions/tickable-mark/`
(the smoove logo icon as a `smooveMark()` component).

## Finding nodes: `query` / `queryOne`

`Composition`, `Sequence`, and `Clip` expose cached queries over their
subtree, using Konva selector syntax (`#id`, `.name`, `TypeName`). Results
are cached against a structure version, so calling them from an updater every
frame costs a map lookup.

```ts
// duck the music while a voice-over clip is active
const musicTrack = new Audio({ id: "music", src: musicSrc });

voiceOver.register((frame, { durationInFrames }) => {
  const music = voiceOver.getComposition()?.queryOne<Audio>("#music");
  music?.volume(interpolate(frame, [0, 15, durationInFrames - 15, durationInFrames], [1, 0.2, 0.2, 1]));
});
```

Query on the `Composition` to reach across sequences (the music usually lives
in a different sequence than the voice-over). Keep a single writer per
animated property: exactly one updater should own `music.volume()`. Set
`id`/`name` at construction; renaming a mounted node does not invalidate the
cache. Predicate queries (`query(n => ...)`) work but are uncached.

## Ancestor getters

Every smoove node has, mirroring Konva's `getStage()`/`getLayer()`:

- `getComposition()`: the owning composition, or `null` while detached.
- `getSequence()`: the host sequence.
- `getClip()`: the nearest ancestor-or-self clip, or `null`.

## Caveat: media inside clips

`Audio`/`Video` scheduling for offline rendering is computed from sequence
ranges. Keep media nodes directly in a `Sequence` for now; a clip that only
contains shapes, text, and groups is fully supported everywhere.
