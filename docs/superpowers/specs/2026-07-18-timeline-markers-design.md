# Timeline markers / cue anchoring — design

Date: 2026-07-18
Status: **approved design, not implemented.**
Origin: item #4 in `2026-07-18-media-audio-text-api-triage.md` (Medium effort,
own branch, no server/client parity risk).

---

## Problem

Beats/scenes are *derived*: `Series` auto-computes each `Sequence`'s `from`
from per-scene `offset`s via `computeOffsets`
(`packages/core/src/engine/offsets.ts`). But cues — an SFX `Audio` placed at an
absolute frame, or a `Sequence` pinned to a number — are hand-pinned. Retime a
beat and everything anchored to it silently desyncs and has to be hand-chased.
The goal: move the beat, the cues follow — editing a video instead of editing
a spreadsheet of frame numbers.

### Today (hand-pinned, desyncs on retime)

```ts
const series = new Series();
series
  .add({ durationInFrames: 60 }, buildIntro)
  .add({ durationInFrames: 90 }, buildCode)   // starts at frame 60… for now
  .add({ durationInFrames: 45 }, buildOutro);

comp.add(series);
// SFX hand-pinned to where "code" happens to start today:
comp.add(
  new Sequence({ from: 60, durationInFrames: 20 })
    .add(new Audio({ src: whoosh })),
);
// Stretch the intro to 75 frames → the whoosh still fires at 60. Silently wrong.
```

### With markers (retime follows)

```ts
const series = new Series();
series
  .add({ durationInFrames: 60, name: "intro" }, buildIntro)
  .add({ durationInFrames: 90, name: "code" }, buildCode)
  .add({ durationInFrames: 45, name: "outro" }, buildOutro);

const codeMarker = series.marker("code");

comp.add(series);
comp.add(
  new Sequence({ from: codeMarker.start, durationInFrames: 20 })
    .add(new Audio({ src: whoosh })),
);
// Stretch the intro to 75 frames → codeMarker.start now resolves to 75; the
// whoosh moves with it.
```

## Concept

A **Marker** is a lazily-resolving, immutable handle onto a *named scene's
placement* inside a `Series` or `TransitionSeries`.

- Scenes gain an optional `name?: string`.
- `series.marker("code")` returns a `Marker`. It stores no frame number.
- Every read resolves by running the series' existing placement
  (`computeOffsets` for `Series`; the overlap-resolving placement in
  `TransitionSeries.sequences()`) and looking up the named scene.
- A standalone `Sequence` is a marker source too: `sequence.marker()` (no
  name — a sequence *is* a single scene) resolves from the sequence's own
  live `from`/`durationInFrames` getters.

A marker is a *view onto a scene*, not a positional entity: retiming any scene
moves every marker derived from scenes placed after it, automatically.

## Marker handle API

New file: `packages/core/src/engine/marker.ts`, exported from the core barrel.

Two levels: a `Marker` is the *scene handle*; it exposes three anchorable
`MarkerPoint`s. Offsets (`.add`) live on the points.

```ts
const codeMarker = series.marker("code");

codeMarker.start        // MarkerPoint: scene window opens
codeMarker.end          // MarkerPoint: window closes (from + durationInFrames)
codeMarker.settled      // MarkerPoint: start + incoming overlap (see below)

codeMarker.start.add(5)     // derived point, integer delta in frames
codeMarker.end.add(-5)      // 5 frames before the window closes
codeMarker.settled.add(5)

codeMarker.resolve()        // sugar for codeMarker.start.resolve() → number
```

- `Marker` is `{ source, name }` plus the three point getters and a
  `resolve()` sugar that delegates to `.start`.
- `MarkerPoint` is `{ source, name, kind: "start" | "end" | "settled", delta }`.
  `.add(n)` returns a **new immutable point** with the delta accumulated;
  `.resolve()` returns the frame number now.
- Anchoring APIs accept `number | Marker | MarkerPoint`; a bare `Marker`
  means its `.start`.
- Resolution goes through an internal source hook,
  `_kmResolveMarker(name): { from, end, settled }`, implemented by `Series`,
  `TransitionSeries`, and `Sequence` (which ignores the name).
  `Marker`/`MarkerPoint` are source-agnostic.
- `resolve()` is public — occasionally useful in updaters and for debugging —
  but anchoring APIs accept the handles themselves; eager `resolve()` at
  authoring time reintroduces the freeze bug and the docs say so.

### Errors

- Unknown scene name at resolve time → throw, message lists available names.
- Duplicate scene `name` within one series → throw at `add()`/`scene()` time.
- Cycle (series A's `from` anchored to a marker of B whose `from` is anchored
  back into A) → a module-level resolution stack in `marker.ts` detects
  re-entry and throws with the chain, instead of recursing forever.
- Resolved frame `< 0` (e.g. `.add(-100)` past the timeline start) → throw at
  resolve time, mirroring the existing `computeOffsets` underflow error.
- `.end` on a sequence marker whose sequence has *default* duration (resolves
  to the host comp's duration; `Infinity` before it's attached) → throw
  "sequence has no explicit duration and isn't attached to a composition"
  rather than silently resolving to `Infinity`.

```ts
series.marker("codee").resolve();
// throws: Series: no scene named "codee" (named scenes: intro, code, outro)

series.add({ durationInFrames: 30, name: "code" }, buildMore);
// throws: Series: duplicate scene name "code"

codeMarker.start.add(-200).resolve();
// throws: marker "code" resolves to -140, before frame 0
```

## Anchoring surface

`from` accepts `number | Marker | MarkerPoint` on **`Sequence`, `Series`, and
`TransitionSeries`** (a bare `Marker` means its `.start`). `Sequence`
additionally accepts `until: number | Marker | MarkerPoint`.

### Sequence

- `SequenceOptions.from?: number | Marker | MarkerPoint`,
  `SequenceOptions.until?: number | Marker | MarkerPoint`.
- `until` and `durationInFrames` are mutually exclusive — constructor throws
  if both are provided.
- `Sequence.from` becomes a **live getter** (the same pattern as the existing
  live `durationInFrames` getter): a number passes through; a marker point resolves
  on every read. Resolution is O(scenes) — trivial per tick.
- With `until`, `durationInFrames` resolves as
  `resolve(until) − resolve(from)`; a result `≤ 0` throws at resolve time.

```ts
// A point cue: overlay title from 5 frames before "code" for 30 frames.
new Sequence({ from: codeMarker.start.add(-5), durationInFrames: 30 });

// A span: underscore music from "code" until "outro" begins.
const outroIn = series.marker("outro");
new Sequence({ from: codeMarker, until: outroIn }) // bare Marker = .start
  .add(new Audio({ src: bed, volume: 0.4 }));

// Invalid — pick one way to say the length:
new Sequence({ from: codeMarker, until: outroIn, durationInFrames: 90 }); // throws
```
- The constructor's `from ≥ 0` validation applies only to number values;
  marker values are validated at resolve time instead.
- Known readers of `.from` (`_apply`, studio `use-layers.ts`) are
  getter-compatible; the public type stays `number` on read.

### Series / TransitionSeries

- `from` option becomes `number | Marker | MarkerPoint`; the public `from`
  becomes a getter
  resolving at read. Internally `_place()` / `sequences()` /
  `durationInFrames` resolve it before calling `computeOffsets`. This lets a
  whole beat-group chain off another series' marker.

```ts
// Act 2 starts when act 1's finale settles — retime act 1, act 2 follows.
const act1 = new Series();
act1
  .add({ durationInFrames: 120, name: "opening" }, buildOpening)
  .add({ durationInFrames: 80, offset: -10, name: "finale" }, buildFinale);

const act2 = new Series({ from: act1.marker("finale").settled });
act2.add({ durationInFrames: 150, name: "reveal" }, buildReveal);

comp.add(act1);
comp.add(act2);
```

### Sequence as a marker source

Any `Sequence` — including hand-placed ones outside any series — hands out
the same handle via `sequence.marker()` (no name argument). It resolves from
the sequence's own live getters: `{ from, end: from + durationInFrames,
settled: from }` (no incoming overlap, so `settled === start`). Because a
sequence's `from` can itself be marker-valued, chains compose; the cycle
guard covers loops.

```ts
const intro = new Sequence({ from: 0, durationInFrames: 60 });

// Chain a hand-placed sequence off another — no Series required:
const code = new Sequence({ from: intro.marker().end, durationInFrames: 90 });

// And an SFX off that:
new Sequence({ from: code.marker().start.add(-3), durationInFrames: 20 })
  .add(new Audio({ src: whoosh }));
```

### Audio (and anything else without its own timeline position)

Unchanged model: audio is range-gated by its wrapping `Sequence`. Anchoring
an SFX is:

```ts
comp.add(
  new Sequence({ from: codeMarker.start.add(-3), durationInFrames: 20 })
    .add(new Audio({ src: whoosh })),
);
```

No new audio-specific verb, no fluent `.at()` — one concept (`from:` takes a
marker), consistent with the config-at-construction style of the codebase.

## Overlap semantics (TransitionSeries and negative Series offsets)

`TransitionSeriesSceneOptions` gains `name?: string`; `TransitionSeries` gains
`.marker(name)`. Per named scene, the resolved placement reports:

- **start** — the sequence window's computed `from`. Under a transition this
  is the frame the transition *begins* — where a whoosh cues.
- **end** — window close (`from + durationInFrames`).
- **settled** — `from + incoming overlap`: for `TransitionSeries`, the
  incoming transition's duration (scene fully revealed); for plain `Series`,
  `max(0, −offset)` — so a hand-overlapped Series scene has the same
  semantics, and back-to-back scenes have `settled === start`.

Because `settled` is derived from the same placement, retiming a *transition*
moves `.settled` too — no manual arithmetic to desync.

```ts
const ts = new TransitionSeries({ composition: comp });
ts.scene({ durationInFrames: 60, name: "title" }, buildTitle);
ts.transition({ presentation: wipe(), timing: linearTiming({ durationInFrames: 15 }) });
ts.scene({ durationInFrames: 90, name: "code" }, buildCode);

const code = ts.marker("code");
// code.resolve()          → 45  (window opens: the wipe begins)
// code.settled.resolve()  → 60  (wipe done, scene fully revealed)
// code.end.resolve()      → 135 (window closes)

comp.add(ts);
// Whoosh riding the wipe:
comp.add(
  new Sequence({ from: code, durationInFrames: 15 })
    .add(new Audio({ src: whoosh })),
);
// Caption that should only appear once the scene has settled:
comp.add(
  new Sequence({ from: code.settled, until: code.end }).add(buildCaption()),
);
// Retime the wipe 15 → 25 frames: the window now opens at 60 − 25 = 35 and
// settles at 35 + 25 = 60. The whoosh moves to 35 (rides the longer wipe);
// the caption still waits for the reveal at 60. Both correct, untouched.
```

## What deliberately doesn't change

- `computeOffsets` stays pure and untouched. Markers read placement output;
  they don't feed into offset computation (beyond a resolved series `from`
  start value).
- `Composition` learns nothing about markers. No global resolution pass, no
  `add()` semantics change.
- Mutating a series **after** `comp.add(series)` remains unsupported, as
  today: a series' own sequences snapshot their placements at `sequences()`
  time, and markers don't rescue that. Documented, not "fixed".
- No media/audio runtime changes. Pure timeline bookkeeping — server/client
  parity is identical by construction.

## Parity checklist (from the triage spec)

- Works via `setFrame(n)` in Node: yes — resolution is synchronous pure
  arithmetic over the scene list.
- Frame-pure: yes — same scene list + same frame in → same placement out; no
  dependence on playback state or on-stage lifetime.
- Async resources: none introduced.
- Server code path: identical by construction (no decode, no DOM).

## Verification

Core has no test harness (per AGENTS.md, don't scaffold Vitest for this).
Verify with `pnpm build` plus a headless Node script driving `setFrame(n)`:

1. A `Series` with named scenes; an SFX-style `Sequence` anchored via
   `marker.start.add(-n)`; an `until:` span across two beats; a `TransitionSeries`
   scene using `.settled`; two hand-placed sequences chained via
   `sequence.marker().end`.
2. Assert resolved `from`/`durationInFrames` for each anchored sequence.
3. Retime one early scene (change its `durationInFrames`), rebuild, and
   assert every anchored value moved in lockstep.
4. Error cases: unknown name, duplicate name, `until` ≤ `from`, cycle.

## Scope

- **Touches:** `packages/core` (`engine/marker.ts` new, `engine/sequence.ts`,
  `engine/series.ts`, barrel `index.ts`), `packages/transitions`
  (`transition-series.ts`: scene names + `marker()`), `doc/README.md` (public
  API change), one changeset (core + transitions are published, fixed group).
- **Branch:** own branch off `main`.
- **Follow-ups, not v1:** docs-site page, `skills/smoove-video` update,
  studio timeline UI showing markers.
