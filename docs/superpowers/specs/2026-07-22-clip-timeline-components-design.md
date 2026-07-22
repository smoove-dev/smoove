# Clip: nested timelines and shareable components

**Date:** 2026-07-22
**Status:** Approved design, not yet implemented

## Problem

smoove has no story for shareable, self-animating components. The engine's
tick hook (`TICK_MARK` + `_kmTick`) works — a prototype logo component in
kitchen-sink (`compositions/tickable-mark/`) proved a node can animate itself
with zero core changes — but it is internal plumbing pressed into service as
a public contract: an underscore method, a magic attr stamp, and a class
requirement. Component authors also lack basics the engine already knows:
which composition/sequence a node lives in, a cheap way to find sibling nodes
from an updater (e.g. duck an audio track named `music` under a voice-over),
and any way to give a subtree its own local timeline without paying for a
whole `Sequence` — which extends `Konva.Layer` and therefore costs one canvas
each and cannot nest.

## Decision summary

1. **`Clip`** — a new core primitive: a range-gated, tickable timeline that
   `extends Group` (no canvas), nests to any depth, and mirrors `Sequence`'s
   option set and `register()`/`marker()` API. A shareable component is a
   plain function that returns a `Clip`.
2. **Shared timeline core** — the range/updater/activation/frame-pass logic
   is extracted from `Sequence` and shared by both classes (mixin, following
   the `FlexShape` precedent). Tickable discovery becomes per-timeline so
   nothing is ticked twice or with a foreign clock.
3. **Cached queries** — `query()`/`queryOne()` on `Composition`, `Sequence`,
   and `Clip`, cached per selector against a per-stage structure version.
4. **Ancestor getters** — `getComposition()`, `getSequence()`, `getClip()`
   on every smoove node, mirroring Konva's `getStage()`/`getLayer()`.
5. **Richer updater payload** — `register((frame, info) => …)` where `info`
   is `{ time, fps, durationInFrames, globalFrame }`, on both `Sequence` and
   `Clip`. `frame` stays the bare first argument: fully backward compatible.

`_kmTick`/`TICK_MARK` remain, but retreat to genuinely internal plumbing
(how a timeline drives media, text tickers, and nested clips). No public API
references them.

## 1. `Clip`

```ts
import { Clip } from "@smoove/core";

new Clip({
  from: 30,             // parent-local frames, or a Marker point (like Sequence)
  durationInFrames: 90, // or `until:` / `span:` — the exact Sequence option set
  // ...plus any GroupConfig: x, y, scale, clip (masking), etc.
});
```

- **Clock.** Clip-local frame = parent-local frame − `from`. The parent is
  whichever timeline is nearest above it (a `Sequence` or another `Clip`).
- **Range gating.** Outside `[from, from + durationInFrames)` the clip is
  hidden (`visible(false)`), its updaters do not run, and on leaving the
  range its subtree media is deactivated — the same contract as a `Sequence`
  going inactive.
- **Defaults.** `from: 0`; duration defaults to the remainder of the parent
  timeline (parent duration − `from`), resolved live like `Sequence`'s
  comp-duration default.
- **Validation.** Same rules as `Sequence`: `span` exclusive with the other
  three, `durationInFrames` exclusive with `until`, integer/positivity
  checks.
- **`register(updater)`** — identical semantics to `Sequence.register`,
  including the unregister return value. Runs only while in range, with the
  clip-local frame.
- **`marker()`** — `Clip` implements `MarkerSource`. Marker points resolve
  through the parent chain to absolute composition frames, so any sequence
  or clip can anchor to a point inside another component's clip.
- **Konva `clip` prop collision.** The masking props (`clip`, `clipFunc`)
  keep their Konva meaning and work on a `Clip` unchanged. The docs call
  this out once; the timeline meaning is dominant in practice.

### The component pattern

The blessed shape for shareable components — a function, no classes, no
engine hooks:

```ts
export function smooveMark({ size, delay = 0, ...placement }: MarkProps): Clip {
  const clip = new Clip(placement);
  const dot = new Circle({ /* geometry in a fixed unit space, scaled by size */ });
  clip.add(dot);
  clip.register((frame, { time }) => {
    // pure function of clip-local time
  });
  return clip;
}

// consumer — drop it anywhere:
seq.add(smooveMark({ size: 420, x: 160, y: 130 }));
```

Portability conventions (documented in the smoove-video skill, not
enforced): author geometry in a fixed unit box scaled by a size prop;
author timing in seconds via `info.time`; keep updaters pure functions of
the frame.

## 2. Shared timeline core & per-timeline ticking

The logic currently private to `Sequence` — anchor resolution (`from` /
`durationInFrames` / `until` / `span`), the updater set, activation and
deactivation (including the media-deactivate walk), the frame pass ordering
(updaters → ticks → flex layout of direct-child layout roots), and the
tickable cache — moves to a shared internal timeline module, applied to
`Konva.Layer` (→ `Sequence`) and smoove `Group` (→ `Clip`) following the
`FlexShape` mixin precedent.

`Sequence` keeps its Layer-only duties unchanged: visibility of the canvas,
`draw()`/`batchDraw()` scheduling, the `_lastLocal` dedupe, `_kmHide`, and
being driven by `Composition._apply`. Its public behavior does not change.

**Per-timeline tickable discovery.** Today `Sequence._tickables()` `find()`s
marked nodes in the whole subtree. With nesting that is wrong twice over: a
ticker inside a clip would be ticked by both the sequence (with the wrong
clock) and the clip. New rule: **each timeline ticks only the marked nodes
whose nearest timeline ancestor is itself.** A nested `Clip` is discovered
as a single tickable unit; when ticked it computes its own local frame,
gates its range, runs its own frame pass, and recurses. Deactivation walks
stop at the same boundary (a deactivating clip owns its own subtree).

**Cache invalidation.** The tickable cache stops using the per-class
`_mediaDirty` flag and keys off the structure version (§3). This also fixes
the flag's existing blind spot: an `add()` deep inside an already-mounted
subtree never set it (only direct `Sequence.add` did).

**Measure path.** `_kmRunFrame`'s `tickMedia: false` mode (used by
`measure()`) is preserved through the shared core, including through nested
clips.

## 3. Cached queries: `query` / `queryOne`

```ts
comp.queryOne<Audio>("#music")?.volume(duck); // cheap to call every frame
seq.query(".bar");                            // Konva selectors: #id, .name, TypeName
```

- **Surface.** `query<T extends Konva.Node>(selector: string): T[]` and
  `queryOne<T>(selector: string): T | null`, on `Composition` (whole stage),
  `Sequence`, and `Clip` (their subtrees). Konva's own uncached
  `find`/`findOne` remain untouched.
- **Caching.** A per-stage **structure version** counter is bumped by any
  `add`, `remove`, or `destroy` anywhere in the tree. Each instance caches
  `selector → { version, result }` and recomputes only when the version
  moved. Steady-state cost of an every-frame query: one Map lookup and one
  number compare.
- **The hook.** The version bump requires seeing structural changes on *all*
  containers, including raw `Konva.Group`s: a small, documented patch of
  `Konva.Container.prototype.add` / `Node.prototype.remove` / `destroy` at
  core module load (idempotent, guarded). Alternative considered — override
  only smoove containers — rejected because one raw Konva group mid-tree
  would silently serve stale query results.
- **Predicate overload.** `query((n) => boolean)` is allowed but uncached
  (function identity is not a usable cache key); the docs steer hot paths to
  string selectors.
- **Ducking use case.** The voice-over pattern works because the query lives
  on `Composition` — the music node is in a different sequence than the
  voice-over clip. Core stays out of write-ownership: the documented pattern
  is single-writer (exactly one updater owns `music.volume()`).

## 4. Ancestor getters

On every smoove node (`FlexShape` mixin, `Group`, `Flex`, `Block`, `Text`,
media nodes) plus `Sequence` and `Clip` themselves:

- `getComposition(): Composition | null` — sugar over
  `getComposition(this.getStage())`.
- `getSequence(): Sequence | null` — the host sequence (nearest Layer,
  narrowed), else `null`.
- `getClip(): Clip | null` — nearest `Clip` ancestor, else `null` (a node
  directly in a sequence has no clip).

Implemented once as shared helpers; each base gets thin methods. Raw Konva
nodes dropped into a scene do not get the getters (they can use the
functional `getComposition(stage)` export as today).

## 5. Updater payload

```ts
type FrameInfo = {
  time: number;             // local seconds: frame / fps
  fps: number;              // host composition fps
  durationInFrames: number; // this timeline's span
  globalFrame: number;      // absolute composition frame
};
type Updater = (localFrame: number, info: FrameInfo) => void;
```

Applies to both `Sequence.register` and `Clip.register`. Existing
single-argument updaters are untouched (extra argument, same first
argument). The `info` object is built once per timeline per frame, not per
updater.

## Rollout

Four independently landable steps, in order:

1. **FrameInfo payload + ancestor getters.** Small, no behavior change.
2. **`Clip` + timeline extraction + per-timeline ticking.** The core of the
   work; includes the discovery-boundary change inside `Sequence`.
3. **Structure version + query cache.** Replaces `_mediaDirty`; adds
   `query`/`queryOne`.
4. **Demo + docs.** Migrate kitchen-sink `tickable-mark` to a
   function-returning-`Clip` component (removing the `_kmTick` subclass),
   and update the smoove-video skill with the component pattern, the
   getters, and `query`.

Versioning (pre-1.0 convention): additive feature → patch changesets; the
`Sequence` internals refactor must not change public behavior.

## Explicitly deferred

- **`Audio`/`Video` scheduled inside a `Clip` for offline rendering.** The
  mixer computes media windows from sequence ranges today; resolving windows
  through the clip chain (intersection of every ancestor range) is its own
  piece of work. V1 documents "media belongs directly to a Sequence"; the
  clip deactivation walk prevents leaks meanwhile. Browser playback of media
  in clips is not blocked, but is unsupported until windows resolve
  correctly.
- **Flex-intrinsic components.** A `Clip` participating in `Flex` layout
  with an intrinsic size (via `measure()`) is a separate exploration.

## Testing

On the existing core vitest rig (`src/engine/*.test.ts`, skia-backed):

- Clip range gating: hidden/inactive outside the window, media deactivated
  on exit.
- Nested clocks: clip-in-clip-in-sequence local frames; `info.time` /
  `globalFrame` correctness at each depth.
- No double-tick: a `TICK_MARK` node inside a clip is ticked exactly once,
  with the clip's clock.
- Late-add invalidation: node added deep inside a mounted subtree joins the
  frame loop (the frozen-video regression class) — now via structure
  version.
- Marker resolution through the clip chain.
- Query caching: repeated query hits cache; add/remove/destroy invalidates;
  predicate overload bypasses cache.
- Updater back-compat: one-arg updaters run unchanged; `info` values match
  frame math.
- Measure path through nested clips (`tickMedia: false` preserved).
