# Timeline Markers / Cue Anchoring — Implementation Plan

> **For agentic workers:** Execute inline in the main session via
> superpowers:executing-plans (subagent-driven execution is forbidden in this
> repo). Steps use checkbox (`- [ ]`) syntax for tracking. **Never `git
> commit`** — leave all changes in the working tree.

**Goal:** Lazily-resolving `Marker`/`MarkerPoint` anchors on `Series`,
`TransitionSeries`, and `Sequence`, accepted by `from:`/`until:`, so retiming a
beat moves everything anchored to it.

**Architecture:** New `engine/marker.ts` in `@smoove/core` holds the
source-agnostic `Marker` (scene handle) and `MarkerPoint` (start/end/settled +
delta) classes plus a module-level cycle guard. Sources implement an internal
`_kmResolveMarker(name)` hook returning `{ from, end, settled }` computed from
their existing placement logic (`computeOffsets`); `Sequence.from` becomes a
live getter (the same pattern as its live `durationInFrames`).

**Tech Stack:** TypeScript, `tsc -b` builds, Biome. No test harness in core —
verification is a headless Node script driving the built dist (per AGENTS.md,
do not scaffold Vitest).

**Spec:** `docs/superpowers/specs/2026-07-18-timeline-markers-design.md`

---

### Task 1: `Marker` / `MarkerPoint` core (`engine/marker.ts`)

**Files:**
- Create: `packages/core/src/engine/marker.ts`

- [ ] **Step 1: Write the file**

```ts
/**
 * Timeline markers: lazily-resolving, immutable handles onto a scene's
 * placement inside a marker source (`Series`, `TransitionSeries`, or a
 * standalone `Sequence`). A marker stores no frame number — every read
 * resolves against the source's *current* placement, so retiming a scene
 * moves everything anchored to it.
 *
 * @module
 */

/** Resolved placement of one scene: window open/close plus the settled point. */
export type ScenePlacement = {
  /** Frame the scene's sequence window opens. */
  from: number;
  /** Frame the window closes (`from + durationInFrames`). */
  end: number;
  /**
   * `from` + incoming overlap — the frame the scene is fully revealed. For
   * `TransitionSeries` the overlap is the incoming transition's duration; for
   * `Series` it is `max(0, −offset)`; for a standalone `Sequence` it is `0`
   * (so `settled === from`).
   */
  settled: number;
};

/**
 * Implemented by anything that hands out markers. `name` is `undefined` for
 * single-scene sources (a standalone `Sequence`).
 *
 * @internal
 */
export type MarkerSource = {
  _kmResolveMarker(name: string | undefined): ScenePlacement;
};

/**
 * Re-entrancy guard: resolving a marker may resolve the source's `from`,
 * which may itself be a marker. A genuine loop revisits the same
 * (source, name) pair — throw instead of recursing forever.
 */
const resolutionStack: Array<{ source: MarkerSource; name: string | undefined }> = [];

function resolvePlacement(source: MarkerSource, name: string | undefined): ScenePlacement {
  for (const entry of resolutionStack) {
    if (entry.source === source && entry.name === name) {
      throw new Error(
        `marker: circular anchoring while resolving "${name ?? "(sequence)"}" — its timeline position depends on itself`,
      );
    }
  }
  resolutionStack.push({ source, name });
  try {
    return source._kmResolveMarker(name);
  } finally {
    resolutionStack.pop();
  }
}

export type MarkerKind = "start" | "end" | "settled";

/**
 * One anchorable point of a marked scene (`start`, `end`, or `settled`),
 * optionally shifted by an integer frame delta. Immutable: `add()` returns a
 * new point. Accepted anywhere a {@link FrameAnchor} is.
 */
export class MarkerPoint {
  /** @internal — obtain points via `Marker#start`/`end`/`settled`. */
  constructor(
    private readonly _source: MarkerSource,
    private readonly _name: string | undefined,
    readonly kind: MarkerKind,
    readonly delta: number,
  ) {}

  /** A new point shifted by `n` frames (integer; deltas accumulate). */
  add(n: number): MarkerPoint {
    if (!Number.isInteger(n)) {
      throw new Error(`marker: add() delta must be an integer (got ${n})`);
    }
    return new MarkerPoint(this._source, this._name, this.kind, this.delta + n);
  }

  /**
   * Resolve to a frame number **now**. Prefer passing the point itself to
   * `from:`/`until:` — an eagerly resolved number freezes and desyncs when
   * the timeline is retimed.
   */
  resolve(): number {
    const placement = resolvePlacement(this._source, this._name);
    const base =
      this.kind === "start"
        ? placement.from
        : this.kind === "end"
          ? placement.end
          : placement.settled;
    if (!Number.isFinite(base)) {
      throw new Error(
        `marker: cannot resolve "${this.kind}"${this._name ? ` of "${this._name}"` : ""} — the source sequence has no explicit duration and isn't attached to a composition`,
      );
    }
    const frame = base + this.delta;
    if (frame < 0) {
      throw new Error(
        `marker: "${this._name ?? "(sequence)"}" ${this.kind}${this.delta ? ` ${this.delta > 0 ? "+" : ""}${this.delta}` : ""} resolves to ${frame}, before frame 0`,
      );
    }
    return frame;
  }
}

/**
 * Handle onto a marked scene. Exposes the three anchorable points; using the
 * bare `Marker` as a {@link FrameAnchor} means its `.start`.
 */
export class Marker {
  /** @internal — obtain via `series.marker(name)` / `sequence.marker()`. */
  constructor(
    private readonly _source: MarkerSource,
    private readonly _name?: string,
  ) {}

  /** The scene's window-open frame (under a transition: the transition begins). */
  get start(): MarkerPoint {
    return new MarkerPoint(this._source, this._name, "start", 0);
  }

  /** The scene's window-close frame. */
  get end(): MarkerPoint {
    return new MarkerPoint(this._source, this._name, "end", 0);
  }

  /** The frame the scene is fully revealed (start + incoming overlap). */
  get settled(): MarkerPoint {
    return new MarkerPoint(this._source, this._name, "settled", 0);
  }

  /** Sugar for `this.start.resolve()`. */
  resolve(): number {
    return this.start.resolve();
  }
}

/** A timeline position: an absolute frame, a `Marker` (its `.start`), or a `MarkerPoint`. */
export type FrameAnchor = number | Marker | MarkerPoint;

/** Resolve a {@link FrameAnchor} to a frame number. @internal */
export function resolveFrameAnchor(anchor: FrameAnchor): number {
  return typeof anchor === "number" ? anchor : anchor.resolve();
}
```

- [ ] **Step 2: Build core**

Run: `pnpm --filter @smoove/core build` (from repo root; it's `tsc -b`)
Expected: clean exit. (The file is not yet imported anywhere.)

---

### Task 2: `Sequence` — marker-valued `from`, `until`, `marker()`, source hook

**Files:**
- Modify: `packages/core/src/engine/sequence.ts`

- [ ] **Step 1: Update imports and `SequenceOptions`**

Replace the import block's engine imports and the options type:

```ts
import Konva from "konva";
import { isKMLayoutRoot } from "../layout/contract.js";
import { MEDIA_MARK, TICK_MARK } from "../media/media-marker.js";
import { getComposition } from "./composition.js";
import {
  type FrameAnchor,
  Marker,
  type MarkerSource,
  resolveFrameAnchor,
  type ScenePlacement,
} from "./marker.js";

export type SequenceOptions = Konva.LayerConfig & {
  /**
   * Composition frame this sequence starts on: an absolute frame, or a
   * `Marker`/`MarkerPoint` resolved live (retiming the marked scene moves
   * this sequence with it). Defaults to `0`.
   */
  from?: FrameAnchor;
  /**
   * How many frames the sequence spans. When omitted it defaults to the host
   * composition's `durationInFrames` — i.e. a layer spanning the whole comp.
   * Resolved live once added (see {@link Sequence.durationInFrames}).
   * Mutually exclusive with {@link until}.
   */
  durationInFrames?: number;
  /**
   * End anchor: the span becomes `resolve(until) − resolve(from)`, kept live
   * so retiming either end moves the window. Mutually exclusive with
   * {@link durationInFrames}.
   */
  until?: FrameAnchor;
};
```

- [ ] **Step 2: Rework the class fields, constructor, and getters**

The class declares `implements MarkerSource`. Replace the `readonly from`
field, constructor, and `durationInFrames` getter:

```ts
export class Sequence extends Konva.Layer implements MarkerSource {
  private readonly _from: FrameAnchor;
  /** Explicit span, or `undefined` to default to `until`/the host comp's duration. */
  private readonly _durationInFrames?: number;
  private readonly _until?: FrameAnchor;
```

(keep the other existing private fields — `_updaters`, `_active`, `_media`,
`_lastLocal` — unchanged)

```ts
  constructor(opts: SequenceOptions = {}) {
    const { from = 0, durationInFrames, until, ...layerOpts } = opts;
    if (typeof from === "number" && (!Number.isInteger(from) || from < 0)) {
      throw new Error("Sequence: from must be a non-negative integer");
    }
    if (durationInFrames !== undefined && until !== undefined) {
      throw new Error("Sequence: durationInFrames and until are mutually exclusive — provide one");
    }
    // durationInFrames is optional: when omitted it resolves to the host comp's
    // duration (see the getter). Only validate an explicitly provided value.
    if (
      durationInFrames !== undefined &&
      (!Number.isInteger(durationInFrames) || durationInFrames <= 0)
    ) {
      throw new Error("Sequence: durationInFrames must be a positive integer");
    }
    if (typeof until === "number" && (!Number.isInteger(until) || until <= 0)) {
      throw new Error("Sequence: until must be a positive integer frame");
    }
    super({ ...layerOpts, visible: false });
    this._from = from;
    this._durationInFrames = durationInFrames;
    this._until = until;
  }

  /**
   * Composition frame this sequence starts on. Marker-valued `from` resolves
   * on every read (live, like {@link durationInFrames}), so retiming the
   * marked scene moves this sequence automatically.
   */
  get from(): number {
    return resolveFrameAnchor(this._from);
  }

  /**
   * Frames this sequence spans. With `until`, resolves live as
   * `resolve(until) − resolve(from)`. When constructed without an explicit
   * span, this resolves **live** to the host composition's
   * `durationInFrames` — a layer that spans the whole comp. Before the
   * sequence is added to a composition (no reachable stage) it reports
   * `Infinity`, meaning "unbounded"; `_apply` is only ever driven by the
   * comp, so by then the real duration is reachable.
   */
  get durationInFrames(): number {
    if (this._until !== undefined) {
      const from = this.from;
      const until = resolveFrameAnchor(this._until);
      const d = until - from;
      if (d <= 0) {
        throw new Error(`Sequence: until (${until}) must be after from (${from})`);
      }
      return d;
    }
    if (this._durationInFrames !== undefined) return this._durationInFrames;
    const stage = this.getStage();
    const comp = stage && getComposition(stage);
    return comp ? comp.durationInFrames.get() : Number.POSITIVE_INFINITY;
  }

  /**
   * A {@link Marker} onto this sequence's own placement — no name, a
   * sequence *is* a single scene. Anchor other sequences to it:
   * `new Sequence({ from: intro.marker().end })`.
   */
  marker(): Marker {
    return new Marker(this);
  }

  /** @internal marker-source hook. A plain sequence has no incoming overlap. */
  _kmResolveMarker(): ScenePlacement {
    const from = this.from;
    return { from, end: from + this.durationInFrames, settled: from };
  }
```

Everything else in the class (`register`, `_apply`, `_kmHide`) is untouched —
`_apply` reads `this.from` and `this.durationInFrames` through the getters.

- [ ] **Step 3: Build core**

Run: `pnpm --filter @smoove/core build`
Expected: clean exit. (`sequences()` in `series.ts` passes numbers, still valid.)

---

### Task 3: `Series` — scene names, marker-valued `from`, `marker()`, source hook

**Files:**
- Modify: `packages/core/src/engine/series.ts`

- [ ] **Step 1: Update imports, options, and class**

```ts
import {
  type FrameAnchor,
  Marker,
  type MarkerSource,
  resolveFrameAnchor,
  type ScenePlacement,
} from "./marker.js";
import { computeOffsets, type OffsetScene, type PlacedScene } from "./offsets.js";
import { Sequence, type SequenceProvider } from "./sequence.js";

export type SeriesOptions = {
  /**
   * Frame the series starts at: an absolute frame or a `Marker`/`MarkerPoint`
   * (e.g. another series' marker), resolved live. Default `0`.
   */
  from?: FrameAnchor;
};

export type SeriesSceneOptions = {
  durationInFrames: number;
  /**
   * Frames added to the previous scene's end before this scene starts. Negative
   * overlaps the previous scene; positive leaves a gap. Default `0` (back-to-back).
   */
  offset?: number;
  /** Optional scene name for `series.marker(name)`. Unique per series. */
  name?: string;
};
```

Class changes — `_from` field + `from` getter, duplicate-name check in
`add()`, and the two marker methods (`_place`, `sequences`,
`durationInFrames` keep their bodies; they read `this.from` via the getter):

```ts
export class Series implements SequenceProvider, MarkerSource {
  private readonly _from: FrameAnchor;
  private readonly _scenes: SceneDef[] = [];

  constructor(opts: SeriesOptions = {}) {
    const from = opts.from ?? 0;
    if (typeof from === "number" && (!Number.isInteger(from) || from < 0)) {
      throw new Error("Series: from must be a non-negative integer");
    }
    this._from = from;
  }

  /** Frame the series starts at. Marker-valued `from` resolves on every read. */
  get from(): number {
    return resolveFrameAnchor(this._from);
  }

  /** Append a scene. The `build` callback populates the created `Sequence`. */
  add(opts: SeriesSceneOptions, build: (seq: Sequence) => void): this {
    if (opts.name !== undefined && this._scenes.some((s) => s.opts.name === opts.name)) {
      throw new Error(`Series: duplicate scene name "${opts.name}"`);
    }
    this._scenes.push({ opts, build });
    return this;
  }

  /**
   * A lazily-resolving {@link Marker} onto the named scene. Resolution runs
   * this series' placement at read time, so retiming any earlier scene moves
   * the marker — and everything anchored to it — automatically.
   */
  marker(name: string): Marker {
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("Series: marker name must be a non-empty string");
    }
    return new Marker(this, name);
  }

  /** @internal marker-source hook. `settled` = start + `max(0, −offset)`. */
  _kmResolveMarker(name: string | undefined): ScenePlacement {
    const i = this._scenes.findIndex((s) => s.opts.name === name);
    if (name === undefined || i < 0) {
      const names = this._scenes
        .map((s) => s.opts.name)
        .filter((n): n is string => n !== undefined);
      throw new Error(
        `Series: no scene named "${name}" (named scenes: ${names.length > 0 ? names.join(", ") : "none"})`,
      );
    }
    const placed = this._place();
    const p = placed[i];
    if (!p) throw new Error(`Series: scene "${name}" has no placement`);
    const offset = this._scenes[i]?.opts.offset ?? 0;
    return {
      from: p.from,
      end: p.from + p.durationInFrames,
      settled: p.from + Math.max(0, -offset),
    };
  }
```

- [ ] **Step 2: Build core**

Run: `pnpm --filter @smoove/core build`
Expected: clean exit.

---

### Task 4: Core barrel exports

**Files:**
- Modify: `packages/core/src/index.ts` (engine block, keeps alphabetical file order — insert between the `environment.js` and `offsets.js` exports)

- [ ] **Step 1: Add the export block**

```ts
export {
  type FrameAnchor,
  Marker,
  type MarkerKind,
  MarkerPoint,
  type MarkerSource,
  // @internal — anchor resolution reused by @smoove/transitions.
  resolveFrameAnchor,
  type ScenePlacement,
} from "./engine/marker.js";
```

- [ ] **Step 2: Build core + verify a quick smoke in Node**

Run: `pnpm --filter @smoove/core build`
Then:

```bash
node -e '
import("./packages/core/dist/index.js").then(({ Series, Sequence }) => {
  const s = new Series();
  s.add({ durationInFrames: 60, name: "intro" }, () => {})
   .add({ durationInFrames: 90, name: "code" }, () => {});
  const code = s.marker("code");
  console.log("code.start:", code.resolve());            // 60
  console.log("code.end:", code.end.resolve());          // 150
  const sfx = new Sequence({ from: code.start.add(-5), durationInFrames: 20 });
  console.log("sfx.from:", sfx.from);                    // 55
});'
```

Expected output: `code.start: 60`, `code.end: 150`, `sfx.from: 55`.

---

### Task 5: `TransitionSeries` — scene names, marker-valued `from`, `marker()`, source hook

**Files:**
- Modify: `packages/transitions/src/transition-series.ts`

- [ ] **Step 1: Update imports and option types**

```ts
import {
  type Composition,
  computeOffsets,
  type FrameAnchor,
  Marker,
  type MarkerSource,
  type OffsetScene,
  type PlacedScene,
  resolveFrameAnchor,
  type ScenePlacement,
  Sequence,
  type SequenceProvider,
} from "@smoove/core";
```

`TransitionSeriesOptions.from` becomes `from?: FrameAnchor` (doc comment: "an
absolute frame or a `Marker`/`MarkerPoint`, resolved live; default `0`").
`TransitionSeriesSceneOptions` becomes:

```ts
export type TransitionSeriesSceneOptions = {
  durationInFrames: number;
  /** Optional scene name for `transitionSeries.marker(name)`. Unique per series. */
  name?: string;
};
```

`SceneItem` gains `name?: string`.

- [ ] **Step 2: Hoist the `SceneRecord` type and extract record building**

Move the `SceneRecord` type (currently declared inside `sequences()`) to
module level, adding `name`:

```ts
type SceneRecord = {
  name?: string;
  durationInFrames: number;
  build: (seq: Sequence) => void;
  incoming?: { presentation: Presentation; timing: Timing; duration: number };
  outgoing?: { presentation: Presentation; timing: Timing; duration: number };
};
```

Extract the record-building loop from `sequences()` into a private method
(same logic, plus `name: item.name`):

```ts
  /** Flatten items into scene records, each carrying its incoming/outgoing transition. */
  private _sceneRecords(): SceneRecord[] {
    const fps = this.composition.fps;
    const records: SceneRecord[] = [];
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      if (item?.kind !== "scene") continue;
      const prev = this._items[i - 1];
      const next = this._items[i + 1];
      const record: SceneRecord = {
        name: item.name,
        durationInFrames: item.durationInFrames,
        build: item.build,
      };
      if (prev?.kind === "transition") {
        const duration = prev.timing.getDurationInFrames(fps);
        record.incoming = { presentation: prev.presentation, timing: prev.timing, duration };
      }
      if (next?.kind === "transition") {
        const duration = next.timing.getDurationInFrames(fps);
        record.outgoing = { presentation: next.presentation, timing: next.timing, duration };
      }
      records.push(record);
    }
    return records;
  }

  /** Place records on the timeline: an incoming transition overlaps by its duration. */
  private _placeRecords(records: SceneRecord[]): PlacedScene[] {
    const offsetScenes: OffsetScene[] = records.map((r) => ({
      durationInFrames: r.durationInFrames,
      offset: r.incoming ? -r.incoming.duration : 0,
    }));
    return computeOffsets(offsetScenes, this.from).placed;
  }
```

`sequences()` drops its inline record loop and offset computation in favor of
`const records = this._sceneRecords();` and
`const placed = this._placeRecords(records);` — the validation loop and
everything after are unchanged.

- [ ] **Step 3: `from` anchor, duplicate-name check, `marker()`, source hook**

Class declares `implements SequenceProvider, MarkerSource`. `readonly from`
becomes `private readonly _from: FrameAnchor` + getter (constructor keeps the
number validation, `typeof from === "number"` guarded, and assigns `_from`):

```ts
  /** Frame the series starts at. Marker-valued `from` resolves on every read. */
  get from(): number {
    return resolveFrameAnchor(this._from);
  }
```

In `scene()`:

```ts
    if (opts.name !== undefined) {
      const dup = this._items.some((it) => it.kind === "scene" && it.name === opts.name);
      if (dup) throw new Error(`TransitionSeries: duplicate scene name "${opts.name}"`);
    }
    this._items.push({ kind: "scene", name: opts.name, durationInFrames: opts.durationInFrames, build });
```

New methods:

```ts
  /**
   * A lazily-resolving {@link Marker} onto the named scene. `start` is the
   * frame the scene's window opens (its incoming transition begins);
   * `settled` is start + the incoming transition's duration (scene fully
   * revealed); `end` is the window close. Retiming scenes *or transitions*
   * moves all three.
   */
  marker(name: string): Marker {
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("TransitionSeries: marker name must be a non-empty string");
    }
    return new Marker(this, name);
  }

  /** @internal marker-source hook. `settled` = start + incoming transition duration. */
  _kmResolveMarker(name: string | undefined): ScenePlacement {
    const records = this._sceneRecords();
    const i = records.findIndex((r) => r.name === name);
    if (name === undefined || i < 0) {
      const names = records.map((r) => r.name).filter((n): n is string => n !== undefined);
      throw new Error(
        `TransitionSeries: no scene named "${name}" (named scenes: ${names.length > 0 ? names.join(", ") : "none"})`,
      );
    }
    const placed = this._placeRecords(records);
    const p = placed[i];
    if (!p) throw new Error(`TransitionSeries: scene "${name}" has no placement`);
    const incoming = records[i]?.incoming?.duration ?? 0;
    return { from: p.from, end: p.from + p.durationInFrames, settled: p.from + incoming };
  }
```

- [ ] **Step 4: Build transitions (against rebuilt core)**

Run: `pnpm --filter @smoove/core build && pnpm --filter @smoove/transitions build`
Expected: clean exit.

---

### Task 6: Headless verification script

**Files:**
- Create: `<scratchpad>/verify-markers.mjs` (session scratchpad — a throwaway,
  not committed to the repo)

Invoke the `smoove-video` skill before writing this script (repo rule: before
any composition-authoring code).

- [ ] **Step 1: Write the script**

```js
// Headless verification for timeline markers (spec §Verification).
// Run from the repo root AFTER `pnpm build`:  node <scratchpad>/verify-markers.mjs
import assert from "node:assert/strict";

const core = await import(
  new URL("packages/core/dist/index.js", `file://${process.cwd()}/`).href
);
const transitions = await import(
  new URL("packages/transitions/dist/index.js", `file://${process.cwd()}/`).href
);
const { Series, Sequence } = core;
const { TransitionSeries, fade, linearTiming } = transitions;

const buildSeries = (introDur) => {
  const s = new Series();
  s.add({ durationInFrames: introDur, name: "intro" }, () => {})
    .add({ durationInFrames: 90, name: "code" }, () => {})
    .add({ durationInFrames: 45, offset: -10, name: "outro" }, () => {});
  return s;
};

// 1. Named scenes resolve; SFX anchor; until: span; settled with Series offset.
{
  const s = buildSeries(60);
  const code = s.marker("code");
  const outro = s.marker("outro");
  assert.equal(code.resolve(), 60);
  assert.equal(code.start.resolve(), 60);
  assert.equal(code.end.resolve(), 150);
  assert.equal(code.settled.resolve(), 60); // no overlap on "code"
  assert.equal(outro.start.resolve(), 140); // 150 − 10 overlap
  assert.equal(outro.settled.resolve(), 150); // start + max(0, −(−10))

  const sfx = new Sequence({ from: code.start.add(-5), durationInFrames: 20 });
  assert.equal(sfx.from, 55);

  const bed = new Sequence({ from: code, until: outro });
  assert.equal(bed.from, 60);
  assert.equal(bed.durationInFrames, 80); // 140 − 60
}

// 2. Retime the intro → everything anchored moves in lockstep.
{
  const s = buildSeries(75);
  const code = s.marker("code");
  const sfx = new Sequence({ from: code.start.add(-5), durationInFrames: 20 });
  const bed = new Sequence({ from: code, until: s.marker("outro") });
  assert.equal(code.resolve(), 75);
  assert.equal(sfx.from, 70);
  assert.equal(bed.from, 75);
  assert.equal(bed.durationInFrames, 80); // span length unchanged
}

// 3. TransitionSeries: start / settled / end under a 15-frame overlap.
{
  const fakeComp = { fps: 30, width: () => 1920, height: () => 1080 };
  const ts = new TransitionSeries({ composition: fakeComp });
  ts.scene({ durationInFrames: 60, name: "title" }, () => {});
  ts.transition({ presentation: fade(), timing: linearTiming({ durationInFrames: 15 }) });
  ts.scene({ durationInFrames: 90, name: "code" }, () => {});
  const code = ts.marker("code");
  assert.equal(code.resolve(), 45); // 60 − 15: window opens as the fade begins
  assert.equal(code.settled.resolve(), 60); // fade done
  assert.equal(code.end.resolve(), 135); // 45 + 90
}

// 4. Hand-placed sequence chaining via sequence.marker().
{
  const intro = new Sequence({ from: 0, durationInFrames: 60 });
  const code = new Sequence({ from: intro.marker().end, durationInFrames: 90 });
  assert.equal(code.from, 60);
  const sfx = new Sequence({ from: code.marker().start.add(-3), durationInFrames: 20 });
  assert.equal(sfx.from, 57);
  assert.equal(code.marker().settled.resolve(), 60); // settled === start for plain sequences
}

// 5. Error cases.
{
  const s = buildSeries(60);
  assert.throws(() => s.marker("codee").resolve(), /no scene named "codee"/);
  assert.throws(
    () => s.add({ durationInFrames: 30, name: "code" }, () => {}),
    /duplicate scene name "code"/,
  );
  assert.throws(() => s.marker("code").start.add(-200).resolve(), /before frame 0/);
  assert.throws(
    () => new Sequence({ from: s.marker("outro"), until: s.marker("code") }).durationInFrames,
    /must be after from/,
  );
  assert.throws(
    () => new Sequence({ from: 0, durationInFrames: 10, until: 20 }),
    /mutually exclusive/,
  );
  // Default-duration sequence: .end must throw, not resolve to Infinity.
  const unbounded = new Sequence({ from: 0 });
  assert.throws(() => unbounded.marker().end.resolve(), /no explicit duration/);
  // Cycle: A anchored to B anchored to A.
  const holder = {};
  const a = new Sequence({
    from: { resolve: () => holder.b.marker().start.resolve() },
    durationInFrames: 10,
  });
  holder.b = new Sequence({ from: a.marker().start, durationInFrames: 10 });
  assert.throws(() => holder.b.from, /circular anchoring/);
}

console.log("timeline markers: all assertions passed");
```

Note on case 5's cycle: `a`'s `from` is a duck-typed anchor (`{ resolve() }`)
so the loop can be closed without forward references; `b.from → a.marker() →
a.from → b.marker() → b already on the resolution stack → throw`. If the
duck-typed anchor doesn't satisfy the `FrameAnchor` runtime path (it does —
`resolveFrameAnchor` only calls `.resolve()`), fall back to two `Series`
anchored to each other's markers.

- [ ] **Step 2: Full build, then run it**

Run: `pnpm build && node <scratchpad>/verify-markers.mjs`
Expected: `timeline markers: all assertions passed`, exit 0.

---

### Task 7: Docs, changeset, lint

**Files:**
- Modify: `doc/README.md` (add a "Timeline markers" section near the Series docs; update the Series/Sequence option lists to mention `name`, `until`, marker-valued `from`)
- Create: `.changeset/heavy-planes-marry.md`

- [ ] **Step 1: Write the README section**

Invoke the `smoove-writing` skill first (repo rule: before any smoove prose).
Content to cover (prose per the skill; code from the spec examples): named
scenes → `series.marker(name)`; the three points and `.add(n)`; `from:`/
`until:` accepting anchors; `sequence.marker()` chaining;
`TransitionSeries` `settled` semantics. Lift the before/after example and the
wipe example from the spec.

- [ ] **Step 2: Write the changeset**

```md
---
"@smoove/core": minor
"@smoove/transitions": minor
---

Timeline markers: name a scene in `Series`/`TransitionSeries` and anchor anything to it. `series.marker("code")` returns a lazily-resolving handle with `.start`/`.end`/`.settled` points (each offsettable via `.add(n)`); `from:` — and the new `until:` on `Sequence` — accept a marker anywhere a frame number worked, and standalone sequences hand out their own via `sequence.marker()`. Retime a beat and every cue anchored to it moves in lockstep.
```

- [ ] **Step 3: Lint + full build**

Run: `pnpm check && pnpm build`
Expected: Biome clean (or `pnpm format` then clean), all packages build.

- [ ] **Step 4: Re-run the verification script**

Run: `node <scratchpad>/verify-markers.mjs`
Expected: `timeline markers: all assertions passed`.

---

## Self-review notes

- **Spec coverage:** Marker/MarkerPoint + cycle guard (Task 1); Sequence
  `from`/`until`/`marker()`/hook + default-duration `.end` error (Tasks 1–2);
  Series names/`from`/`marker()`/`settled = max(0, −offset)` (Task 3); barrel
  (Task 4); TransitionSeries names/`from`/`marker()`/settled-by-transition
  (Task 5); every spec error case + parity-checklist verification via
  headless `setFrame`-style pure resolution (Task 6); `doc/README.md` +
  changeset (Task 7). Spec's "resolution runs under a comp in Node" needs no
  renderer: marker resolution is pure arithmetic, and Task 6 runs entirely in
  Node.
- **Type consistency:** `FrameAnchor`, `ScenePlacement`, `MarkerSource`,
  `_kmResolveMarker(name)` used identically across Tasks 1/2/3/5;
  `resolveFrameAnchor` exported for transitions in Task 4 before Task 5 uses it.
- **Repo-rule deltas from the skill template:** no commit steps (NEVER COMMIT
  rule), no Vitest/TDD steps (core has no test harness; verification is the
  Task 6 script), inline execution only (no subagents).
