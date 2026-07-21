# Planner Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline execution; subagent-driven execution is disallowed in this repo). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author-declared timeline markers (`new Marker({start, durationInFrames})`), a `plan()` helper, `Composition` duration from an anchor, `Sequence({span})` sugar, and `probeMedia()` in `@smoove/media`.

**Architecture:** Declared markers become their own `MarkerSource` inside the existing lazy-resolution system in `packages/core/src/engine/marker.ts`, so `.start`/`.end`/`.settled` are ordinary `MarkerPoint`s and every existing `FrameAnchor` consumer works unchanged. `Composition` learns to resolve an anchor-valued duration lazily on first read and cache it into its signal. `probeMedia` reads container metadata through a mediabunny `Input` using the same src handling `envelope.ts` already has (extracted to a shared module).

**Tech Stack:** TypeScript, Konva, mediabunny, vitest (both packages have rigs: `pnpm --filter @smoove/core test`, `pnpm --filter @smoove/media test`), Biome (`pnpm check`).

Spec: `docs/superpowers/specs/2026-07-21-planner-markers-design.md`.

---

### Task 0: Feature branch

- [ ] **Step 1: Create branch**

```bash
git -C /Users/rotem/development/konva-motion checkout -b feat/planner-markers
git add docs/superpowers/specs/2026-07-21-planner-markers-design.md docs/superpowers/plans/2026-07-21-planner-markers.md
git commit -m "docs: planner markers spec + implementation plan"
```

(No Co-Authored-By trailer — repo convention.)

---

### Task 1: Public `Marker` constructor

**Files:**
- Modify: `packages/core/src/engine/marker.ts`
- Test: `packages/core/src/engine/marker.test.ts` (new)
- Modify: `packages/core/src/index.ts` (export `MarkerOptions`)

- [ ] **Step 1: Write failing tests** — create `packages/core/src/engine/marker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Marker } from "./marker.js";

describe("declared Marker", () => {
  it("resolves start/end/settled from start + durationInFrames", () => {
    const m = new Marker({ start: 10, durationInFrames: 50 });
    expect(m.start.resolve()).toBe(10);
    expect(m.end.resolve()).toBe(60);
    expect(m.settled.resolve()).toBe(10);
  });

  it("defaults start to 0", () => {
    const m = new Marker({ durationInFrames: 30 });
    expect(m.start.resolve()).toBe(0);
    expect(m.end.resolve()).toBe(30);
  });

  it("chains: a marker's start can be another marker's end", () => {
    const intro = new Marker({ start: 0, durationInFrames: 150 });
    const hero = new Marker({ start: intro.end, durationInFrames: 300 });
    const outro = new Marker({ start: hero.end, durationInFrames: 150 });
    expect(outro.start.resolve()).toBe(450);
    expect(outro.end.resolve()).toBe(600);
  });

  it("accepts a bare Marker as start (meaning its .start)", () => {
    const a = new Marker({ start: 5, durationInFrames: 10 });
    const b = new Marker({ start: a, durationInFrames: 10 });
    expect(b.start.resolve()).toBe(5);
  });

  it("supports until instead of durationInFrames", () => {
    const a = new Marker({ start: 0, durationInFrames: 100 });
    const b = new Marker({ start: 20, until: a.end });
    expect(b.end.resolve()).toBe(100);
  });

  it("throws when neither or both of durationInFrames/until are given", () => {
    expect(() => new Marker({ start: 0 })).toThrow(/exactly one/);
    const a = new Marker({ durationInFrames: 10 });
    expect(() => new Marker({ start: 0, durationInFrames: 10, until: a.end })).toThrow(/exactly one/);
  });

  it("validates durationInFrames and numeric start eagerly", () => {
    expect(() => new Marker({ durationInFrames: 0 })).toThrow(/positive integer/);
    expect(() => new Marker({ durationInFrames: 1.5 })).toThrow(/positive integer/);
    expect(() => new Marker({ start: -1, durationInFrames: 10 })).toThrow(/non-negative/);
    expect(() => new Marker({ start: 1.5, durationInFrames: 10 })).toThrow(/non-negative/);
  });

  it("throws at resolve when until lands at or before start", () => {
    const a = new Marker({ start: 0, durationInFrames: 10 });
    const b = new Marker({ start: 50, until: a.end });
    expect(() => b.end.resolve()).toThrow(/after start/);
  });

  it("detects circular anchoring between declared markers", () => {
    // a.end depends on b.end which depends on a.end. The options object uses
    // a getter so `until` is read lazily at resolve time (the implementation
    // reads `opts.until` inside `_kmResolveMarker`, see Step 3).
    let a: Marker;
    const b = new Marker({
      start: 0,
      get until() {
        return a.end;
      },
    });
    a = new Marker({ start: b.end, durationInFrames: 10 });
    expect(() => a.start.resolve()).toThrow(/circular/);
  });
});
```

Caveat: the exactly-one validation in `makeDeclaredSource` reads `opts.until`
once at construction; with the getter above, `a` is still unassigned at that
moment. TDZ makes that a ReferenceError. To keep validation eager AND the
cycle constructible, the validation must check presence via
`"until" in opts` / `Object.hasOwn` style OR tolerate the getter throwing.
Simplest correct approach (use this): validate with
`(durationInFrames === undefined) === !("until" in opts)` so the getter is
not invoked during construction, and only read `opts.until` inside
`_kmResolveMarker`. Adjust the test's `b` to omit `durationInFrames` entirely
(`{ start: 0, get until() { return a.end; } }`).

- [ ] **Step 2: Run tests, verify they fail**

```bash
pnpm --filter @smoove/core test -- marker.test
```

Expected: FAIL — the `Marker` constructor rejects option objects (no `_kmResolveMarker`).

- [ ] **Step 3: Implement** — in `packages/core/src/engine/marker.ts`, add after the `MarkerKind` type:

```ts
/** Options for a directly declared marker: a named time range planned up front. */
export type MarkerOptions = {
  /** Where the range opens. Default `0`. A bare `Marker` means its `.start`. */
  start?: FrameAnchor;
  /** Length in frames (positive integer). Mutually exclusive with {@link until}. */
  durationInFrames?: number;
  /** Where the range closes. Mutually exclusive with {@link durationInFrames}. */
  until?: FrameAnchor;
};

function isMarkerSource(x: MarkerSource | MarkerOptions): x is MarkerSource {
  return typeof (x as MarkerSource)._kmResolveMarker === "function";
}

/**
 * Source for a declared marker. `overlap` is the incoming overlap absorbed
 * into `settled` — only `plan()` sets it; the public constructor path leaves
 * it 0 so `settled === start`.
 */
function makeDeclaredSource(opts: MarkerOptions, overlap = 0): MarkerSource {
  const { start = 0, durationInFrames } = opts;
  // Presence check via `in`, not a read: `until` may be a getter onto a
  // not-yet-constructed marker (see the circularity test) — it is only read
  // lazily inside `_kmResolveMarker`.
  const hasUntil = "until" in opts;
  if ((durationInFrames === undefined) === !hasUntil) {
    throw new Error("Marker: provide exactly one of durationInFrames or until");
  }
  if (
    durationInFrames !== undefined &&
    (!Number.isInteger(durationInFrames) || durationInFrames <= 0)
  ) {
    throw new Error("Marker: durationInFrames must be a positive integer");
  }
  if (typeof start === "number" && (!Number.isInteger(start) || start < 0)) {
    throw new Error("Marker: start must be a non-negative integer");
  }
  return {
    _kmResolveMarker(): ScenePlacement {
      const from = resolveFrameAnchor(start);
      const end =
        durationInFrames !== undefined
          ? from + durationInFrames
          : resolveFrameAnchor(opts.until as FrameAnchor);
      if (end <= from) {
        throw new Error(`Marker: until (${end}) must be after start (${from})`);
      }
      return { from, end, settled: from + overlap };
    },
  };
}
```

Change the `Marker` class constructor (keep the class doc, replace the
parameter-property constructor with explicit fields):

```ts
export class Marker {
  private readonly _source: MarkerSource;
  private readonly _name?: string;

  /**
   * Declare a marker directly: `new Marker({ start, durationInFrames })` —
   * a planned time range whose points anchor sequences and other markers.
   * The `(source, name)` form is internal; obtain derived markers via
   * `series.marker(name)` / `sequence.marker()`.
   */
  constructor(options: MarkerOptions);
  /** @internal */
  constructor(source: MarkerSource, name?: string);
  constructor(sourceOrOptions: MarkerSource | MarkerOptions, name?: string) {
    if (isMarkerSource(sourceOrOptions)) {
      this._source = sourceOrOptions;
      this._name = name;
    } else {
      this._source = makeDeclaredSource(sourceOrOptions);
      this._name = undefined;
    }
  }
  // ...getters unchanged
}
```

`resolveFrameAnchor` is declared later in the file than `makeDeclaredSource`
uses it; function hoisting makes that fine (it is a `function` declaration).

Export `MarkerOptions` from `packages/core/src/index.ts` in the existing
marker export block.

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm --filter @smoove/core test -- marker.test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/marker.ts packages/core/src/engine/marker.test.ts packages/core/src/index.ts
git commit -m "feat(core): public Marker constructor for declared timeline ranges"
```

---

### Task 2: `plan()` helper

**Files:**
- Modify: `packages/core/src/engine/marker.ts`
- Test: `packages/core/src/engine/marker.test.ts`
- Modify: `packages/core/src/index.ts` (export `plan`, `PlanStep`)

- [ ] **Step 1: Write failing tests** — append to `marker.test.ts`:

```ts
import { plan } from "./marker.js"; // merge into the existing import

describe("plan()", () => {
  it("chains named beats back to back", () => {
    const { intro, hero, outro } = plan({
      intro: { durationInFrames: 150 },
      hero: { durationInFrames: 300 },
      outro: { durationInFrames: 150 },
    });
    expect(intro.start.resolve()).toBe(0);
    expect(hero.start.resolve()).toBe(150);
    expect(outro.start.resolve()).toBe(450);
    expect(outro.end.resolve()).toBe(600);
  });

  it("applies offset as gap or overlap, and settles after an overlap", () => {
    const { a, b, c } = plan({
      a: { durationInFrames: 100 },
      b: { durationInFrames: 100, offset: -10 }, // overlap
      c: { durationInFrames: 100, offset: 20 }, // gap
    });
    expect(b.start.resolve()).toBe(90);
    expect(b.settled.resolve()).toBe(100); // start + |offset|
    expect(c.start.resolve()).toBe(210); // 190 + 20
    expect(c.settled.resolve()).toBe(210); // gap: settled === start
  });

  it("anchors the whole plan with opts.from", () => {
    const pre = new Marker({ start: 0, durationInFrames: 60 });
    const { main } = plan({ main: { durationInFrames: 90 } }, { from: pre.end });
    expect(main.start.resolve()).toBe(60);
  });

  it("throws on an empty plan and on non-integer offsets", () => {
    expect(() => plan({})).toThrow(/at least one/);
    expect(() => plan({ a: { durationInFrames: 10, offset: 0.5 } })).toThrow(/integer/);
  });
});
```

- [ ] **Step 2: Run tests, verify the new describe fails**

```bash
pnpm --filter @smoove/core test -- marker.test
```

Expected: FAIL — `plan` is not exported.

- [ ] **Step 3: Implement** — append to `marker.ts`:

```ts
/** One beat in a {@link plan}: a length plus an optional shift off the previous beat's end. */
export type PlanStep = {
  /** Length in frames (positive integer). */
  durationInFrames: number;
  /**
   * Frames between the previous beat's end and this beat's start: `0`
   * back-to-back (default), negative overlaps, positive leaves a gap. Same
   * semantics as `Series`.
   */
  offset?: number;
};

/** Shift a {@link FrameAnchor} by `n` frames without resolving it. */
function shiftAnchor(anchor: FrameAnchor, n: number): FrameAnchor {
  if (n === 0) return anchor;
  if (typeof anchor === "number") return anchor + n;
  const point = anchor instanceof Marker ? anchor.start : anchor;
  return point.add(n);
}

/**
 * Lay out named beats back to back and return a `Marker` per key, in insertion
 * order. Sugar over chained `new Marker({...})`: the first beat starts at
 * `opts.from` (default `0`, any anchor), each next beat at the previous end
 * shifted by its `offset`. With a negative `offset` the beat's `settled` is
 * `start + |offset|`, mirroring `Series`.
 *
 * ```ts
 * const { intro, hero } = plan({
 *   intro: { durationInFrames: 5 * fps },
 *   hero:  { durationInFrames: 10 * fps, offset: -10 },
 * });
 * new Sequence({ span: hero });
 * ```
 */
export function plan<T extends Record<string, PlanStep>>(
  steps: T,
  opts: { from?: FrameAnchor } = {},
): { [K in keyof T]: Marker } {
  const names = Object.keys(steps);
  if (names.length === 0) {
    throw new Error("plan: at least one step is required");
  }
  const out: Record<string, Marker> = {};
  let prevEnd: FrameAnchor = opts.from ?? 0;
  for (const name of names) {
    const step = steps[name] as PlanStep;
    const offset = step.offset ?? 0;
    if (!Number.isInteger(offset)) {
      throw new Error(`plan: "${name}" offset must be an integer (got ${offset})`);
    }
    const marker = new Marker(
      makeDeclaredSource(
        { start: shiftAnchor(prevEnd, offset), durationInFrames: step.durationInFrames },
        Math.max(0, -offset),
      ),
    );
    out[name] = marker;
    prevEnd = marker.end;
  }
  return out as { [K in keyof T]: Marker };
}
```

Export `plan` and `PlanStep` from `packages/core/src/index.ts`.

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm --filter @smoove/core test -- marker.test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/marker.ts packages/core/src/engine/marker.test.ts packages/core/src/index.ts
git commit -m "feat(core): plan() helper for declaring chained timeline beats"
```

---

### Task 3: `Composition.durationInFrames` accepts a `FrameAnchor`

**Files:**
- Modify: `packages/core/src/engine/composition.ts`
- Test: `packages/core/src/engine/marker.test.ts`

- [ ] **Step 1: Write failing tests** — append to `marker.test.ts`:

```ts
import { Composition } from "./composition.js";
import { Sequence } from "./sequence.js";
import { Series } from "./series.js";

let compN = 0;
function compOpts() {
  compN += 1;
  return { id: `marker-comp-${compN}`, fps: 30, width: 320, height: 240 };
}

describe("Composition durationInFrames from an anchor", () => {
  it("resolves a marker point lazily on first read", () => {
    const { outro } = plan({
      intro: { durationInFrames: 150 },
      outro: { durationInFrames: 150 },
    });
    const comp = new Composition({ ...compOpts(), durationInFrames: outro.end });
    expect(comp.durationInFrames.get()).toBe(300);
  });

  it("accepts a bare Marker (its .start would be useless; .end is the idiom) and a Series-derived anchor added after construction", () => {
    const series = new Series();
    const comp = new Composition({
      ...compOpts(),
      durationInFrames: series.marker("outro").end,
    });
    series
      .add({ durationInFrames: 100, name: "intro" }, () => {})
      .add({ durationInFrames: 50, name: "outro" }, () => {});
    comp.add(series);
    expect(comp.durationInFrames.get()).toBe(150);
  });

  it("throws when the anchor resolves to a non-positive duration", () => {
    const m = new Marker({ start: 0, durationInFrames: 10 });
    const comp = new Composition({ ...compOpts(), durationInFrames: m.start });
    expect(() => comp.durationInFrames.get()).toThrow(/positive integer/);
  });

  it("still validates plain numbers eagerly", () => {
    expect(() => new Composition({ ...compOpts(), durationInFrames: 0 })).toThrow(
      /positive integer/,
    );
  });

  it("a spanning Sequence follows the resolved duration", () => {
    const { only } = plan({ only: { durationInFrames: 90 } });
    const comp = new Composition({ ...compOpts(), durationInFrames: only.end });
    const seq = new Sequence();
    comp.add(seq);
    expect(seq.durationInFrames).toBe(90);
  });
});
```

- [ ] **Step 2: Run, verify failure** — type error / eager-validation throw on anchor input.

- [ ] **Step 3: Implement** — in `composition.ts`:

1. Import anchors:

```ts
import { type FrameAnchor, resolveFrameAnchor } from "./marker.js";
```

2. Options type: change `durationInFrames: number` to:

```ts
    /**
     * Total frames, or a `Marker`/`MarkerPoint` (e.g. `outro.end`) resolved
     * lazily on first read — so a comp can end where its last planned beat
     * ends, and retiming the plan retimes the comp.
     */
    durationInFrames: number | FrameAnchor;
```

(`FrameAnchor` already includes `number`; write it as `FrameAnchor` and say so in the doc.)

3. Constructor: replace the eager validation with:

```ts
    if (
      typeof opts.durationInFrames === "number" &&
      (!Number.isInteger(opts.durationInFrames) || opts.durationInFrames <= 0)
    ) {
      throw new Error("Composition: durationInFrames must be a positive integer");
    }
```

4. Add a private field near the other privates:

```ts
  // Anchor-valued duration, pending lazy resolution on first read (see
  // durationInFrames getter wiring in the constructor). Null once resolved.
  private _durationAnchor: FrameAnchor | null = null;
```

5. Signal wiring: replace

```ts
    this._durationInFrames = createSignal(durationInFrames);
```

with

```ts
    if (typeof durationInFrames === "number") {
      this._durationInFrames = createSignal(durationInFrames);
    } else {
      // Resolved lazily on first read: the anchor may depend on a Series
      // added after construction. Markers are immutable, so the first
      // resolution is cached into the signal and never re-run.
      this._durationInFrames = createSignal(0);
      this._durationAnchor = durationInFrames;
    }
```

and replace

```ts
    this.durationInFrames = this._durationInFrames;
```

with

```ts
    this.durationInFrames = {
      get: () => {
        this._ensureDurationResolved();
        return this._durationInFrames.get();
      },
      subscribe: (listener) => this._durationInFrames.subscribe(listener),
    };
```

6. Add the resolver method (near `setFrame` or the other private helpers):

```ts
  /** Resolve an anchor-valued duration into the signal, once. */
  private _ensureDurationResolved(): void {
    if (this._durationAnchor === null) return;
    const resolved = resolveFrameAnchor(this._durationAnchor);
    if (!Number.isInteger(resolved) || resolved <= 0) {
      throw new Error(
        `Composition: durationInFrames anchor resolved to ${resolved} — must be a positive integer`,
      );
    }
    this._durationAnchor = null;
    this._durationInFrames.set(resolved);
  }
```

7. Update the four internal reads (`setFrame` clamp ×2, the event payload
builder, and the last-frame computation at lines ~371/480/548/589) from
`this._durationInFrames.get()` to `this.durationInFrames.get()` so every path
resolves first. Grep to catch them all:

```bash
grep -n "_durationInFrames.get()" packages/core/src/engine/composition.ts
```

- [ ] **Step 4: Run full core suite** (not just marker tests — composition is load-bearing):

```bash
pnpm --filter @smoove/core test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/composition.ts packages/core/src/engine/marker.test.ts
git commit -m "feat(core): Composition durationInFrames accepts a marker anchor"
```

---

### Task 4: `Sequence` `span` sugar

**Files:**
- Modify: `packages/core/src/engine/sequence.ts`
- Test: `packages/core/src/engine/marker.test.ts`

- [ ] **Step 1: Write failing tests** — append to `marker.test.ts`:

```ts
describe("Sequence span", () => {
  it("spans exactly the marker's range", () => {
    const { hero } = plan({
      intro: { durationInFrames: 100 },
      hero: { durationInFrames: 200 },
    });
    const seq = new Sequence({ span: hero });
    expect(seq.from).toBe(100);
    expect(seq.durationInFrames).toBe(200);
  });

  it("is mutually exclusive with from/durationInFrames/until", () => {
    const m = new Marker({ durationInFrames: 10 });
    expect(() => new Sequence({ span: m, from: 0 })).toThrow(/span/);
    expect(() => new Sequence({ span: m, durationInFrames: 5 })).toThrow(/span/);
    expect(() => new Sequence({ span: m, until: 20 })).toThrow(/span/);
  });
});
```

- [ ] **Step 2: Run, verify failure** (unknown option `span` — the layer config
passthrough means the failure shows as wrong from/duration, or a type error).

- [ ] **Step 3: Implement** — in `sequence.ts`:

Add to `SequenceOptions`:

```ts
  /**
   * Span exactly this marker's range — sugar for
   * `{ from: marker.start, until: marker.end }`. Mutually exclusive with
   * `from`, `durationInFrames`, and `until`.
   */
  span?: Marker;
```

In the constructor, destructure `span` out of `opts` alongside the others and
add before the existing validation:

```ts
    const { from = 0, durationInFrames, until, span, ...layerOpts } = opts;
    if (span !== undefined) {
      if ("from" in opts || durationInFrames !== undefined || until !== undefined) {
        throw new Error(
          "Sequence: span is mutually exclusive with from/durationInFrames/until",
        );
      }
    }
```

and after `super(...)`, assign:

```ts
    this._from = span !== undefined ? span.start : from;
    this._durationInFrames = durationInFrames;
    this._until = span !== undefined ? span.end : until;
```

(`Marker` is already imported in this file.)

- [ ] **Step 4: Run core suite**

```bash
pnpm --filter @smoove/core test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/sequence.ts packages/core/src/engine/marker.test.ts
git commit -m "feat(core): Sequence span option to cover a marker's range"
```

---

### Task 5: Mixed-provenance coverage (declared ↔ derived)

**Files:**
- Test: `packages/core/src/engine/marker.test.ts`

- [ ] **Step 1: Add tests** (these should pass immediately — they lock in the
composability the design promises; if any fails, the implementation above is
wrong, fix it before committing):

```ts
describe("mixed provenance", () => {
  it("a Series can start at a declared marker's end", () => {
    const { pre } = plan({ pre: { durationInFrames: 40 } });
    const series = new Series({ from: pre.end });
    series.add({ durationInFrames: 60, name: "a" }, () => {});
    expect(series.marker("a").start.resolve()).toBe(40);
  });

  it("a declared marker can hang off a series beat", () => {
    const series = new Series();
    series
      .add({ durationInFrames: 100, name: "intro" }, () => {})
      .add({ durationInFrames: 120, name: "code" }, () => {});
    const overlay = new Marker({ start: series.marker("code").start.add(-10), durationInFrames: 50 });
    expect(overlay.start.resolve()).toBe(90);
    expect(overlay.end.resolve()).toBe(140);
  });
});
```

- [ ] **Step 2: Run and commit**

```bash
pnpm --filter @smoove/core test -- marker.test
git add packages/core/src/engine/marker.test.ts
git commit -m "test(core): declared/derived marker interop coverage"
```

---

### Task 6: `probeMedia()` in `@smoove/media`

**Files:**
- Create: `packages/media/src/input-source.ts`
- Create: `packages/media/src/probe.ts`
- Create: `packages/media/src/probe.test.ts`
- Modify: `packages/media/src/audio/envelope.ts` (use the shared source helper)
- Modify: `packages/media/src/index.ts` (export `probeMedia`, `MediaMetadata`)

- [ ] **Step 1: Extract the src → mediabunny Source helper.** Create
`packages/media/src/input-source.ts` with the body of `makeEnvelopeSource`
moved verbatim from `envelope.ts`:

```ts
import { FilePathSource, type Source, UrlSource } from "mediabunny";

/**
 * Mediabunny source for a media src string. Browser srcs are URLs; server
 * renders resolve Vite asset URLs to filesystem paths (the `mediaSrc`
 * helper), so anything that isn't `http(s)` is treated as a local path —
 * mirrors the renderer's `makeInputSource`.
 */
export function makeInputSource(src: string): Source {
  if (/^https?:\/\//i.test(src)) return new UrlSource(src);
  if (src.startsWith("file://")) return new FilePathSource(new URL(src).pathname);
  // Root-relative/relative srcs: in a browser they're asset URLs (Vite serves
  // them; fetch resolves against the page), in Node they're local paths.
  if (typeof document !== "undefined") return new UrlSource(src);
  return new FilePathSource(src);
}
```

In `envelope.ts`: delete the local `makeEnvelopeSource`, import
`makeInputSource` from `../input-source.js`, replace the one call site
(`new Input({ formats: ALL_FORMATS, source: makeInputSource(src) })`), and
drop the now-unused `FilePathSource`/`UrlSource`/`Source` imports.

Run the existing envelope tests to prove the extraction is behavior-neutral:

```bash
pnpm --filter @smoove/media test
```

Expected: PASS. Commit the refactor alone:

```bash
git add packages/media/src/input-source.ts packages/media/src/audio/envelope.ts
git commit -m "refactor(media): extract shared mediabunny input source helper"
```

- [ ] **Step 2: Write failing probe tests.** Create
`packages/media/src/probe.test.ts` (the WAV writer mirrors
`envelope.test.ts`'s):

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeMedia } from "./probe.js";

/** Minimal mono 16-bit PCM WAV: `seconds` of a 440 Hz sine at 8 kHz. */
function writeSineWav(path: string, seconds: number): void {
  const sr = 8000;
  const n = Math.round(sr * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr);
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
}

function makeWav(seconds: number): string {
  const dir = mkdtempSync(join(tmpdir(), "smoove-probe-test-"));
  const path = join(dir, "tone.wav");
  writeSineWav(path, seconds);
  return path;
}

describe("probeMedia", () => {
  it("reads duration and track shape from a Node file path", async () => {
    const meta = await probeMedia(makeWav(1.5));
    expect(meta.duration).toBeCloseTo(1.5, 2);
    expect(meta.hasAudio).toBe(true);
    expect(meta.hasVideo).toBe(false);
    expect(meta.width).toBeUndefined();
    expect(meta.sampleRate).toBe(8000);
    expect(meta.channels).toBe(1);
  });

  it("durationInFrames floors so the window never outruns the media", async () => {
    const meta = await probeMedia(makeWav(1.5));
    expect(meta.durationInFrames(30)).toBe(45);
    // 1.5s at 29.97 -> 44.955 frames -> 44
    expect(meta.durationInFrames(29.97)).toBe(44);
    expect(() => meta.durationInFrames(0)).toThrow(/positive/);
  });

  it("memoizes by src", async () => {
    const src = makeWav(0.5);
    const a = probeMedia(src);
    const b = probeMedia(src);
    expect(a).toBe(b); // same in-flight promise
    expect(await a).toBe(await b);
  });

  it("rejects for a src with no media tracks and does not cache the failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smoove-probe-test-"));
    const bogus = join(dir, "not-media.txt");
    writeFileSync(bogus, "hello");
    await expect(probeMedia(bogus)).rejects.toThrow();
    await expect(probeMedia(bogus)).rejects.toThrow(); // second read re-attempts
  });
});
```

Run and verify failure (module `./probe.js` doesn't exist):

```bash
pnpm --filter @smoove/media test -- probe
```

- [ ] **Step 3: Implement.** Create `packages/media/src/probe.ts`:

```ts
import { ALL_FORMATS, Input } from "mediabunny";
import { makeInputSource } from "./input-source.js";

/** Container-level metadata for a media file, read without decoding frames. */
export type MediaMetadata = {
  /** Seconds, from container metadata (`Input.computeDuration`). */
  duration: number;
  /**
   * `floor(duration * fps)`: the clip's length as a frame count that never
   * outruns the media — feed it to a `Marker`/`plan()` step.
   */
  durationInFrames(fps: number): number;
  hasVideo: boolean;
  hasAudio: boolean;
  /** Display size of the primary video track. Present when {@link hasVideo}. */
  width?: number;
  height?: number;
  /** Primary audio track shape. Present when {@link hasAudio}. */
  sampleRate?: number;
  channels?: number;
};

const cache = new Map<string, Promise<MediaMetadata>>();

/**
 * Read a media file's container metadata (duration, track shape) without
 * decoding any frames — cheap enough to await at module top level, before
 * building a composition, so real clip lengths can drive the timeline plan:
 *
 * ```ts
 * const meta = await probeMedia(heroClip);
 * const { hero } = plan({ hero: { durationInFrames: meta.durationInFrames(fps) } });
 * ```
 *
 * Works on URLs in the browser and file paths in Node (same src handling as
 * `Audio`/`Video`). Results are memoized by `src`; failures are not cached.
 */
export function probeMedia(src: string): Promise<MediaMetadata> {
  let pending = cache.get(src);
  if (!pending) {
    pending = readMetadata(src);
    pending.catch(() => cache.delete(src));
    cache.set(src, pending);
  }
  return pending;
}

async function readMetadata(src: string): Promise<MediaMetadata> {
  const input = new Input({ formats: ALL_FORMATS, source: makeInputSource(src) });
  try {
    const [video, audio] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);
    if (!video && !audio) {
      throw new Error(`[smoove] probeMedia: no video or audio track in: ${src}`);
    }
    const duration = await input.computeDuration();
    return {
      duration,
      durationInFrames(fps: number): number {
        if (!Number.isFinite(fps) || fps <= 0) {
          throw new Error(`probeMedia: fps must be a positive number (got ${fps})`);
        }
        return Math.floor(duration * fps);
      },
      hasVideo: video !== null,
      hasAudio: audio !== null,
      width: video?.displayWidth,
      height: video?.displayHeight,
      sampleRate: audio?.sampleRate,
      channels: audio?.numberOfChannels,
    };
  } finally {
    input.dispose();
  }
}
```

Export from `packages/media/src/index.ts`:

```ts
export { type MediaMetadata, probeMedia } from "./probe.js";
```

- [ ] **Step 4: Run media suite**

```bash
pnpm --filter @smoove/media test
```

Expected: PASS. (Deviation from spec noted: video-track fields are exercised
through the absent-video branch only; a binary video fixture is not worth
checking in, and the video path shares every line of code with the audio
path except two property reads.)

- [ ] **Step 5: Commit**

```bash
git add packages/media/src/probe.ts packages/media/src/probe.test.ts packages/media/src/index.ts
git commit -m "feat(media): probeMedia() container metadata for timeline planning"
```

---

### Task 7: Skill rules + docs site

**Files:**
- Modify: `.claude/skills/smoove-video/rules/sequencing.md` (add plan-first section)
- Modify: `.claude/skills/smoove-video/rules/media.md` (probeMedia)
- Modify: `packages/docs/content/docs/markers.mdx` (declared markers, `plan()`, `span`, comp duration)
- Modify: `packages/docs/content/docs/video.mdx` and `packages/docs/content/docs/audio.mdx` (probeMedia mention, link to markers page)

- [ ] **Step 1: sequencing.md** — after the existing "Timeline markers" section,
add a "Plan the timeline first" subsection showing: `plan()` with named beats,
`durationInFrames: outro.end` on the Composition, `span:` on Sequence, and the
probeMedia one-liner (pointing at rules/media.md for details). Follow the
smoove-writing style rules (no em dashes in new prose; note the existing file
uses them, do not rewrite existing text).

- [ ] **Step 2: media.md** — add a "Know a clip's length up front" section:
`await probeMedia(src)` at module top level, `meta.durationInFrames(fps)`
into a plan step, note it works in browser and Node and is memoized.

- [ ] **Step 3: markers.mdx** — add sections "Declare markers up front"
(`new Marker({start, durationInFrames})`, chaining), "plan()" (named beats,
offset), "Span a sequence" (`span:`), and "End the comp at a marker"
(`durationInFrames: outro.end`). Keep the page's existing voice; write per
the smoove-writing skill (short sentences, code-led, no em dashes, no
framework comparisons).

- [ ] **Step 4: video.mdx + audio.mdx** — one short "Probe metadata" section
each with the probeMedia example, cross-linking the markers page.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/smoove-video/rules/sequencing.md .claude/skills/smoove-video/rules/media.md packages/docs/content/docs/markers.mdx packages/docs/content/docs/video.mdx packages/docs/content/docs/audio.mdx
git commit -m "docs: planner markers, plan(), span, and probeMedia"
```

---

### Task 8: Changesets + full verification

**Files:**
- Create: `.changeset/planner-markers.md`
- Create: `.changeset/probe-media.md`

- [ ] **Step 1: Changesets** (patch: additive, pre-1.0 convention):

`.changeset/planner-markers.md`:

```md
---
"@smoove/core": patch
---

Declared timeline markers for planning a composition up front. `new Marker({ start, durationInFrames })` creates a named time range directly (start accepts any anchor, so markers chain: `start: intro.end`), and `plan()` lays out a whole set of named beats in one call with per-beat gap/overlap offsets. `Composition` now accepts a marker point as `durationInFrames` (resolved lazily, so the comp ends where the last beat ends), and `Sequence` gains `span: marker` as sugar for covering exactly a marker's range. Declared and Series-derived markers interoperate: either can anchor the other.
```

`.changeset/probe-media.md`:

```md
---
"@smoove/media": patch
---

`probeMedia(src)` reads a media file's container metadata (duration, video size, track shape) without decoding frames, in the browser and in Node. Await it at module top level and feed `meta.durationInFrames(fps)` into a timeline plan so real clip lengths drive the beat layout. Results are memoized per src.
```

- [ ] **Step 2: Full verification**

```bash
pnpm --filter @smoove/core test && pnpm --filter @smoove/media test
pnpm check
pnpm build
```

Expected: all pass. (`pnpm build` catches cross-package type breakage —
composition.ts's option type change flows into player/studio/renderer.)

- [ ] **Step 3: Commit**

```bash
git add .changeset/planner-markers.md .changeset/probe-media.md
git commit -m "chore: changesets for planner markers and probeMedia"
```

---

## Self-review notes

- Spec coverage: §1 constructor → Task 1; §2 plan() → Task 2; §3 comp
  duration → Task 3; §4 span → Task 4; §5 probeMedia → Task 6; mixed
  provenance tests → Task 5; docs/skills → Task 7; versioning → Task 8.
- Known deviation: no binary video fixture (spec asked for dimension
  assertions against a clip); covered by the shared code path + absent-video
  branch, called out in Task 6 Step 4.
- The circularity test in Task 1 Step 1 contains an intentionally flagged
  broken draft followed by the corrected version — implement only the
  corrected version.
