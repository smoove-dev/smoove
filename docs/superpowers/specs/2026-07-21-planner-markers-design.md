# Planner markers, plan(), and probeMedia() - design

Date: 2026-07-21
Status: **approved design, not implemented.**
Builds on: `2026-07-18-timeline-markers-design.md` (the derived-marker system,
shipped in `packages/core/src/engine/marker.ts`).

---

## Problem

Markers today are derived: you get one from a `Series` or `Sequence` that
already exists (`series.marker("code")`). That covers "anchor a cue to a
beat", but not the planning workflow, where the author wants to sketch the
timeline first and fill in scenes second:

```ts
// What the author wants to write, before any Sequence exists:
const intro = new Marker({ start: 0, durationInFrames: 5 * fps });
const hero  = new Marker({ start: intro.end, durationInFrames: 10 * fps });
const outro = new Marker({ start: hero.end, durationInFrames: 5 * fps });

const comp = new Composition({ fps, durationInFrames: outro.end, width, height });
```

Today none of that parses: the `Marker` constructor is internal, and
`Composition` only takes a number for `durationInFrames`. The author falls
back to hand-summed frame counts, which is exactly the desync trap the
marker system was built to remove.

A second gap feeds the first: when a beat's length should come from a real
clip ("the hero section lasts as long as hero.mp4"), there is no public way
to read a media file's duration up front. The `Audio`/`Video` nodes probe it
internally for playback but never expose it.

## Concept

One `Marker` concept, two provenances. A `Marker` is a named time range on
the timeline. You can derive one from a `Series` scene, or declare one
directly. Either way its `.start`/`.end`/`.settled` are the same lazily
resolving `MarkerPoint`s the engine already accepts anywhere a `FrameAnchor`
goes, so declared and derived markers interleave freely and all existing
plumbing (`.add(n)` shifting, circular-anchor detection, the below-frame-0
guard) applies unchanged.

The full workflow this design enables:

```ts
import { Composition, Sequence, plan } from "@smoove/core";
import { probeMedia } from "@smoove/media";

const heroMeta = await probeMedia(heroClip);

const { intro, hero, outro } = plan({
  intro: { durationInFrames: 5 * fps },
  hero:  { durationInFrames: heroMeta.durationInFrames(fps) },
  outro: { durationInFrames: 5 * fps },
});

const comp = new Composition({ fps, durationInFrames: outro.end, width, height });

comp.add(new Sequence({ span: intro }).add(introContent));
comp.add(new Sequence({ span: hero }).add(heroContent));
comp.add(new Sequence({ from: outro.start.add(-10), durationInFrames: 20 }).add(stinger));
```

Retiming one beat moves every downstream beat, every sequence anchored to
them, and the composition's own duration.

## 1. Public `Marker` constructor

File: `packages/core/src/engine/marker.ts`.

```ts
type MarkerOptions = {
  /** Where the range opens. Default 0. A bare Marker means its .start. */
  start?: FrameAnchor;
  /** Length in frames. Positive integer. Mutually exclusive with until. */
  durationInFrames?: number;
  /** Where the range closes. Mutually exclusive with durationInFrames. */
  until?: FrameAnchor;
};

new Marker(options: MarkerOptions)
```

The constructor gains an overload. The existing internal `(source, name?)`
form stays for `series.marker()` / `sequence.marker()`; the two are
disambiguated by checking the first argument for `_kmResolveMarker`.

A declared marker builds its own private `MarkerSource` whose
`_kmResolveMarker` computes:

- `from = resolveFrameAnchor(start)`
- `end = from + durationInFrames`, or `resolveFrameAnchor(until)`
- `settled = from` (a declared marker has no incoming overlap of its own;
  `plan()` overlaps are the exception, see below)

Resolution goes through the existing `resolutionStack`, so a circular chain
(`a.start = b.end`, `b.start = a.end`) throws the existing clear error.
`start` may itself be a series-derived point, so a declared plan can hang
off a `Series` beat and vice versa.

Validation at construction: exactly one of `durationInFrames`/`until`;
`durationInFrames` must be a positive integer. Validation at resolve time:
`until` must land after `start`; `start` at or after frame 0 (already
enforced by `MarkerPoint.resolve`).

## 2. `plan()` helper

File: `packages/core/src/engine/marker.ts`, exported from the core index.

```ts
type PlanStep = {
  durationInFrames: number;
  /** Shift relative to the previous beat's end. 0 back-to-back (default),
      negative overlap, positive gap. Same semantics as Series. */
  offset?: number;
};

function plan<T extends Record<string, PlanStep>>(
  steps: T,
  opts?: { from?: FrameAnchor },
): { [K in keyof T]: Marker };
```

- The first marker's `start` is `opts.from` (default 0). Each subsequent
  marker's `start` is `previous.end.add(offset)`.
- The return type is mapped from the input keys, so destructuring is fully
  typed and a typo'd name is a compile error.
- With a negative `offset`, the beat's `settled` is `start + |offset|`,
  mirroring `Series`. Back-to-back beats keep `settled === start`.
- Key order follows object insertion order (guaranteed for string keys in
  JS). An empty plan throws. Non-integer `offset` throws.
- Sugar over chained `new Marker({...})`: lazy resolution, circularity
  detection, and the below-frame-0 guard all come from the primitive. The
  one thing the public options cannot express is an incoming overlap, so
  `plan()` sets the marker's overlap through an internal constructor
  option (not part of the public `MarkerOptions` surface).

The named-object form was chosen over a positional array so names stay
attached to durations and inserting a beat cannot silently shift the wrong
name onto the wrong duration.

## 3. `Composition.durationInFrames` accepts a `FrameAnchor`

File: `packages/core/src/engine/composition.ts`.

```ts
new Composition({ fps, durationInFrames: outro.end, width, height });
```

`durationInFrames: number | Marker | MarkerPoint`. A number behaves exactly
as today (validated eagerly). An anchor is resolved lazily on first read of
the `durationInFrames` signal, then cached into it:

- Lazy, because the anchor may depend on a `Series` that is added to the
  composition after construction. Resolving in the constructor would throw
  or freeze a wrong value.
- Cached, because markers are immutable and the scene graph is fixed at
  module load. Retiming happens by editing code, which re-evaluates the
  module; nothing retimes a live composition, so re-resolving on every read
  buys nothing.

The positive-integer validation moves to resolve time for the anchor path.
The public surface, `durationInFrames: ReadonlySignal<number>`, is
unchanged, so the player, studio, and renderer need no changes.

## 4. `Sequence` gains `span`

File: `packages/core/src/engine/sequence.ts`.

```ts
new Sequence({ span: hero });
// identical to:
new Sequence({ from: hero.start, until: hero.end });
```

`span: Marker`. Mutually exclusive with `from`, `durationInFrames`, and
`until` (combining throws). Internally it just sets `_from`/`_until`; no new
resolution logic.

## 5. `probeMedia()` in `@smoove/media`

File: new module under `packages/media/src/`, exported from the media index.

```ts
async function probeMedia(src: string): Promise<MediaMetadata>;

type MediaMetadata = {
  /** Seconds, read from container metadata. */
  duration: number;
  /** floor(duration * fps): a planned window never outruns the media. */
  durationInFrames(fps: number): number;
  hasVideo: boolean;
  hasAudio: boolean;
  width?: number;       // present when hasVideo
  height?: number;      // present when hasVideo
  sampleRate?: number;  // present when hasAudio
  channels?: number;    // present when hasAudio
};
```

- Implemented on a mediabunny `Input` over the same src handling the
  `Audio`/`Video` nodes use, so it works in the browser (URL) and in Node
  (file path), and composes with the renderer's `mediaSrc` helper for
  server renders. Container metadata only, no frame decoding, so a probe is
  cheap. The `Input` is disposed after reading.
- Results are memoized by `src`: probing a clip and then mounting it as a
  `Video` node, or probing it twice across markers, costs one read.
- Async model: the author awaits `probeMedia` at module top level, before
  building the comp. Markers and the whole `FrameAnchor` chain stay
  synchronous. Every path that loads composition modules (Vite dev, the
  studio, `ssrLoadModule` rendering) already supports top-level await.
- Frame purity is preserved: probing runs once at module load, before the
  composition exists, so the values are constants for the life of the comp.

## Non-goals

- No `calcDurationTo` helper. `durationInFrames: outro.end` covers it
  without introducing an eagerly resolved number (the desync trap).
- No marker names or registration on the composition, and no studio
  timeline lanes. Declared markers are ephemeral planning objects with zero
  runtime footprint. Studio display can be a follow-up.
- No runtime retiming of markers. They are immutable, matching the rest of
  the scene graph.
- No async anchors. Media metadata feeds the planner through top-level
  await, not through the engine.

## Testing

Core (`packages/core`, existing vitest rig), new `marker.test.ts` cases plus
`sequence.test.ts` additions:

- Chained declared markers resolve correctly; retiming one shifts
  downstream `start`/`end` on next resolve.
- `until` vs `durationInFrames` forms; both-or-neither throws; `until`
  before `start` throws at resolve.
- Mixed provenance: a declared marker anchored to `series.marker(...)` and
  a `Series` `from` anchored to a declared marker.
- Circularity between declared markers throws the existing error.
- `plan()`: chaining, `offset` gap/overlap, `settled` under overlap,
  typed key mapping, empty plan throws, `opts.from` anchoring.
- `Composition` with an anchor duration: resolves on first read, including
  an anchor onto a `Series` added after construction; non-positive
  resolution throws.
- `span`: equivalence with `from`/`until`, exclusivity errors.

Media (`packages/media`, existing vitest rig), against a small fixture clip:

- Duration, dimensions, and track flags match the fixture.
- `durationInFrames` floors.
- Cache hit on a second probe of the same src.
- A Node file-path probe (the browser-vs-Node source split is where this
  would regress).

## Docs and skill updates

- `.claude/skills/smoove-video/rules/sequencing.md`: add the
  plan-first workflow (declared markers, `plan()`, `span`, comp duration
  from an anchor) alongside the existing derived-marker section.
- `.claude/skills/smoove-video/rules/media.md`: document `probeMedia` and
  the top-level-await pattern.
- Docs site: extend the sequencing/markers page and the media page to
  match.

## Versioning

Additive feature: patch changesets for `@smoove/core` and `@smoove/media`,
per the pre-1.0 convention.
