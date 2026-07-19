# Lifetime-independent `measure()` Implementation Plan

> **For agentic workers:** execute inline in the main session (Rotem's standing
> preference — no subagent-driven execution). Steps use checkbox (`- [ ]`)
> syntax for tracking. **Do not `git commit` at any step** — Rotem commits when
> he asks to; the "commit" steps standard to this format are intentionally
> omitted.

**Goal:** `measure(node, { at? })` — lay a node out on demand regardless of its
sequence's lifetime and return stage-space bounds, with per-line glyph
ink + baseline detail for `Text`.

**Architecture:** a free function in a new `layout/measure.ts` drives the
existing frame/layout machinery: an extracted `Sequence._kmRunFrame` replays a
sequence's updaters + ticks at any local frame, `_kmComputeLayout()` runs on
the node's outermost flex root, and bounds read back through
`getAbsoluteTransform()`. `Text` exposes line detail via a new optional
contract hook `_kmMeasureLines`, whose ink math mirrors Konva 10.3's
alphabetic-baseline draw path. Spec:
`docs/superpowers/specs/2026-07-19-node-measure-design.md`.

**Tech Stack:** TypeScript, Konva 10.3, flexily, vitest + `konva/skia-backend`
(skia-canvas) for headless tests — core's first test rig, modeled on
`@smoove/code`'s vitest setup and `@smoove/renderer`'s skia registration.

---

## File structure

- Create `packages/core/vitest.config.ts` — vitest config (node env + setup file).
- Create `packages/core/src/test/setup.ts` — installs `konva/skia-backend`.
- Create `packages/core/src/layout/measure.ts` — `measure()`, `Measurement`/`MeasuredRect`/`MeasuredLine`/`MeasureOptions` types, root-finding, transform read-back, re-entrancy guard.
- Create `packages/core/src/layout/text/ink.ts` — baseline-offset + per-line ink metrics (scratch-context `measureText`), kept out of the already-large `text.ts`.
- Create `packages/core/src/layout/measure.test.ts` — behavior tests.
- Create `packages/core/src/layout/text/ink.test.ts` — Text line/ink/pixel-bracket tests.
- Modify `packages/core/src/engine/sequence.ts` — extract `_kmRunFrame(local, tickMedia)` from `_apply`, add `_kmLiveLocal()`.
- Modify `packages/core/src/layout/contract.ts` — `LocalMeasuredLine` type + `_kmMeasureLines?` hook.
- Modify `packages/core/src/layout/text/text.ts` — implement `_kmMeasureLines()` + `measure()` sugar.
- Modify `packages/core/src/layout/flex/flex.ts`, `packages/core/src/layout/block.ts`, `packages/core/src/layout/image.ts`, `packages/core/src/layout/flex/mixin.ts` — `measure()` sugar.
- Modify `packages/core/src/index.ts` — export `measure` + types.
- Modify `packages/core/package.json` — `test` scripts + `vitest`/`skia-canvas` devDeps.
- Create `.changeset/node-measure.md` — patch changeset (pre-1.0 convention: additive = patch).
- Create `packages/docs/src/demos/measure-reveal.ts` + modify `packages/docs/content/docs/measure.mdx` (new), `packages/docs/content/docs/meta.json` — docs page + live demo.
- Modify `skills/smoove-video/rules/shapes.md` and `.agents/skills/smoove-video/rules/shapes.md` — teach the skill the new API.

---

### Task 1: Core test rig (vitest + skia backend)

**Files:**
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/test/setup.ts`
- Modify: `packages/core/package.json`
- Test: `packages/core/src/test/setup.test.ts` (smoke, deleted in Task 3)

- [ ] **Step 1: Add devDeps + scripts**

In `packages/core/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

and add a `"devDependencies"` block (core has none today):

```json
"devDependencies": {
  "skia-canvas": "^3.0.8",
  "vitest": "^3.2.4"
}
```

Then run: `pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Write the config + setup**

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

`packages/core/src/test/setup.ts`:

```ts
// Konva needs a canvas implementation in Node. The skia backend patches
// Konva.Util.createCanvasElement/createImageElement and installs
// DOMMatrix/Path2D globals — same backend @smoove/renderer uses in production,
// so tests exercise the real server code path.
import "konva/skia-backend";
```

- [ ] **Step 3: Write a smoke test proving headless layout works**

`packages/core/src/test/setup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Composition, Flex, Rect, Sequence } from "../index.js";

describe("headless rig", () => {
  it("lays out a flex row under skia", () => {
    const comp = new Composition({
      id: "rig-smoke",
      fps: 30,
      durationInFrames: 10,
      width: 800,
      height: 600,
    });
    const seq = new Sequence();
    const flex = new Flex({ flexDirection: "row", gap: 10 });
    const a = new Rect({ width: 50, height: 40, fill: "#f00" });
    const b = new Rect({ width: 30, height: 40, fill: "#00f" });
    flex.add(a);
    flex.add(b);
    seq.add(flex);
    comp.add(seq);
    comp.setFrame(0);
    expect(b.x()).toBe(60); // 50 + 10 gap
  });
});
```

- [ ] **Step 4: Run it**

Run: `pnpm --filter @smoove/core test`
Expected: PASS. If `Composition` construction fails on a missing DOM, the skia
backend didn't load — check the setup file path in the vitest config before
touching product code.

### Task 2: Extract `Sequence._kmRunFrame`

**Files:**
- Modify: `packages/core/src/engine/sequence.ts:155-191` (`_apply`)

Pure refactor + two internal additions; Task 3's tests cover the new methods,
Task 1's smoke test plus a full build guard the refactor.

- [ ] **Step 1: Add `_kmRunFrame` and `_kmLiveLocal`, rewire `_apply`**

In `packages/core/src/engine/sequence.ts`, replace the middle of `_apply`
(the updater/tick/layout section, currently lines 172-178):

```ts
      const local = frame - this.from;
      // Skip redundant work: same playhead, already active, and not forced.
      if (!becameActive && !force && local === this._lastLocal) return;
      this._lastLocal = local;
      this._kmRunFrame(local, true);
```

and add these methods after `_apply`:

```ts
  /**
   * Internal — the frame pass shared by {@link _apply} and `measure()`:
   * updaters, ticks, then flex layout of every direct-child layout root. No
   * visibility change, no draw, no `_lastLocal` bookkeeping — callers own
   * that. With `tickMedia: false` (the measure path) media-only nodes
   * (`MEDIA_MARK` without `TICK_MARK`) are skipped: media state never affects
   * layout, and ticking a video at a foreign frame would trigger spurious
   * seeks.
   */
  _kmRunFrame(local: number, tickMedia: boolean): void {
    // While inactive there is no cached tickable list (that cache is built on
    // activation), so collect on demand.
    const tickables = this._active
      ? this._media
      : (this.find(
          (n: Konva.Node) => n.getAttr(MEDIA_MARK) === true || n.getAttr(TICK_MARK) === true,
        ) as MediaNode[]);
    for (const u of this._updaters) u(local);
    // Tick BEFORE layout: a ticked node may change its measured size (e.g. a
    // Text typewriter revealing another line), and the flex pass must see the
    // up-to-date size this frame rather than lagging one behind.
    for (const v of tickables) {
      if (!tickMedia && v.getAttr(MEDIA_MARK) === true && v.getAttr(TICK_MARK) !== true) {
        continue;
      }
      v._kmTick?.(local);
    }
    for (const c of this.getChildren()) {
      if (isKMLayoutRoot(c)) c._kmComputeLayout();
    }
  }

  /** Internal — the live local frame while active, else `null`. `measure()`
   *  uses this to restore an active sequence after a foreign-frame pass. */
  _kmLiveLocal(): number | null {
    return this._active ? this._lastLocal : null;
  }
```

Delete the now-duplicated updater/tick/layout loops from `_apply` (the
tick-before-layout comment moves into `_kmRunFrame`).

- [ ] **Step 2: Verify nothing changed behaviorally**

Run: `pnpm --filter @smoove/core build && pnpm --filter @smoove/core test`
Expected: build clean, smoke test PASS.

### Task 3: `measure()` core (box path)

**Files:**
- Create: `packages/core/src/layout/measure.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/layout/measure.test.ts`
- Delete: `packages/core/src/test/setup.test.ts` (superseded by real tests)

- [ ] **Step 1: Write the failing tests**

`packages/core/src/layout/measure.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { Composition, Flex, measure, Rect, Sequence, Text } from "../index.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `measure-t${n}`,
    fps: 30,
    durationInFrames: 300,
    width: 1280,
    height: 720,
  });
}

describe("measure — box path", () => {
  it("measures a flex tile in a never-activated sequence (the hero-mask case)", () => {
    const comp = makeComp();
    const later = new Sequence({ from: 100, durationInFrames: 50 });
    const flex = new Flex({ x: 100, y: 200, flexDirection: "row", gap: 10 });
    const a = new Rect({ width: 50, height: 40, fill: "#f00" });
    const b = new Rect({ width: 30, height: 40, fill: "#00f" });
    flex.add(a);
    flex.add(b);
    later.add(flex);
    comp.add(later);
    comp.setFrame(0); // seek straight past — `later` never activates

    const m = measure(b);
    expect(m).toMatchObject({ x: 160, y: 200, width: 30, height: 40 }); // 100+50+10

    // Equivalence: activating for real yields the same geometry.
    comp.setFrame(120);
    expect(b.getAbsolutePosition()).toMatchObject({ x: 160, y: 200 });
  });

  it("includes ancestor transforms (stage space)", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const flex = new Flex({ x: 30, y: 40, flexDirection: "row" });
    const r = new Rect({ width: 20, height: 20, fill: "#0f0" });
    flex.add(r);
    seq.add(flex);
    comp.add(seq);
    comp.setFrame(0);
    flex.scale({ x: 2, y: 2 });
    const m = measure(r);
    expect(m).toMatchObject({ x: 30, y: 40, width: 40, height: 40 });
  });

  it("drives updaters to the requested frame with { at }", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const box = new Rect({ x: 0, y: 0, width: 10, height: 10, fill: "#f00" });
    seq.add(box);
    seq.register((local) => {
      box.width(10 + local * 2);
    });
    comp.add(seq);
    comp.setFrame(0);
    expect(measure(box, { at: 20 }).width).toBe(50);
    // Inactive sequence: measured state persists (per spec's mutation decision).
    expect(box.width()).toBe(50);
  });

  it("restores an active sequence to its live frame after { at }", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const box = new Rect({ x: 0, y: 0, width: 10, height: 10, fill: "#f00" });
    seq.add(box);
    seq.register((local) => {
      box.width(10 + local);
    });
    comp.add(seq);
    comp.setFrame(5); // active, live local 5 → width 15
    const m = measure(box, { at: 50 });
    expect(m.width).toBe(60);
    expect(box.width()).toBe(15); // restored exactly
  });

  it("reflects a typewriter reveal height with { at } (reserveHeight: false)", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 50, durationInFrames: 200 });
    const col = new Flex({ flexDirection: "column", width: 200 });
    const t = new Text({
      text: "one two three four five six seven eight nine ten eleven twelve",
      fontSize: 24,
      typewriter: { step: 1, reserveHeight: false },
    });
    col.add(t);
    seq.add(col);
    comp.add(seq);
    comp.setFrame(0);
    const early = measure(t, { at: 1 }).height;
    const late = measure(t, { at: 199 }).height;
    expect(late).toBeGreaterThan(early);
  });

  it("throws on { at } outside a Sequence", () => {
    const lone = new Rect({ width: 10, height: 10 });
    expect(() => measure(lone, { at: 3 })).toThrow(/Sequence/);
  });

  it("throws on a non-integer { at }", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const box = new Rect({ width: 10, height: 10 });
    seq.add(box);
    comp.add(seq);
    expect(() => measure(box, { at: 1.5 })).toThrow(/integer/);
    expect(() => measure(box, { at: -1 })).toThrow(/integer/);
  });

  it("throws when { at } re-enters from a measure-driven updater", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const box = new Rect({ x: 0, y: 0, width: 10, height: 10, fill: "#f00" });
    seq.add(box);
    seq.register(() => {
      measure(box, { at: 0 });
    });
    comp.add(seq);
    comp.setFrame(0);
    expect(() => measure(box, { at: 1 })).toThrow(/re-enter/);
  });

  it("measures a bare node without { at } even when detached", () => {
    const lone = new Rect({ x: 7, y: 8, width: 10, height: 12 });
    expect(measure(lone)).toMatchObject({ x: 7, y: 8, width: 10, height: 12 });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @smoove/core test`
Expected: FAIL — `measure` is not exported.

- [ ] **Step 3: Add the contract hook**

In `packages/core/src/layout/contract.ts`, after the `MeasureContext` export
(measure.ts in the next step compiles against this):

```ts
/** Per-rendered-line geometry in node-local space, produced by
 *  {@link KMLayoutNode._kmMeasureLines}. `measure()` transforms these to
 *  stage space. */
export type LocalMeasuredLine = {
  /** The line box: rendered width, one lineHeight tall. */
  rect: LayoutBox;
  /** Tight glyph ink rect (falls back to `rect` without canvas metrics). */
  ink: LayoutBox;
  /** Node-local y of the alphabetic baseline. */
  baseline: number;
  /** Char offsets into the displayed text. */
  range: { start: number; end: number };
};
```

and extend the `KMLayoutNode` interface:

```ts
  /** Text-like leaves: per-rendered-line geometry for `measure()`. */
  _kmMeasureLines?(): LocalMeasuredLine[];
```

- [ ] **Step 4: Implement `measure.ts`**

`packages/core/src/layout/measure.ts`:

```ts
import Konva from "konva";
import { Sequence } from "../engine/sequence.js";
import { isKMLayoutNode, isKMLayoutRoot, type KMLayoutNode, type LayoutBox } from "./contract.js";

export type MeasureOptions = {
  /** Owning sequence's local frame to measure at. Runs the sequence's
   *  updaters + non-media ticks (no visibility change, no draw) first. */
  at?: number;
};

/** A stage-space axis-aligned rectangle. */
export type MeasuredRect = { x: number; y: number; width: number; height: number };

export type MeasuredLine = MeasuredRect & {
  /** Tight rect around the rendered glyph ink. Falls back to the line box
   *  where `actualBoundingBox` metrics are unavailable. */
  ink: MeasuredRect;
  /** Stage-space y of the alphabetic baseline — the underline anchor. */
  baseline: number;
  /** Char offsets into the displayed (post-fit/clamp) text. */
  range: { start: number; end: number };
};

export type Measurement = MeasuredRect & {
  /** Text only: one entry per rendered (wrapped) line, top to bottom. */
  lines?: MeasuredLine[];
};

// Re-entrancy guard: an updater running inside a measure-driven frame pass
// must not start another frame pass (updater → measure → updater recursion).
let measuring = false;

/**
 * Measure a node's rendered bounds independent of its sequence's lifetime.
 *
 * Runs the flex compute path for the node's outermost layout root on demand
 * (so a node in a never-activated sequence still measures correctly) and
 * returns stage-space bounds. With `{ at }`, the owning sequence's updaters
 * and ticks are first driven to that local frame — an active sequence is
 * restored to its live frame afterwards (frame purity makes that exact).
 *
 * Bounds reflect currently-loaded fonts; await `comp.whenReady()` first for
 * final glyph bounds in the browser. Rotated nodes yield the axis-aligned
 * bounding box of their rotated geometry.
 */
export function measure(node: Konva.Node, opts: MeasureOptions = {}): Measurement {
  const at = opts.at;
  if (at === undefined) {
    computeRootOf(node);
    return read(node);
  }
  if (!Number.isInteger(at) || at < 0) {
    throw new Error("measure: at must be a non-negative integer local frame");
  }
  const layer = node.getLayer();
  const seq = layer instanceof Sequence ? layer : null;
  if (!seq) throw new Error("measure: { at } requires the node to be inside a Sequence");
  if (measuring) {
    throw new Error("measure: cannot re-enter with { at } from a frame updater");
  }
  const live = seq._kmLiveLocal();
  measuring = true;
  try {
    seq._kmRunFrame(at, false);
    return read(node);
  } finally {
    // Restore an ACTIVE sequence to its live frame so the visible canvas
    // can't be left desynced (frame purity makes this exact). An inactive
    // sequence keeps the measured state — activation re-derives everything.
    if (live !== null && live !== at) seq._kmRunFrame(live, false);
    measuring = false;
  }
}

/** Lay out the outermost KM layout root on the node's ancestor chain. */
function computeRootOf(node: Konva.Node): void {
  let root: (Konva.Node & Required<Pick<KMLayoutNode, "_kmComputeLayout">>) | null = null;
  let cur: Konva.Node | null = node;
  while (cur && !(cur instanceof Konva.Layer) && !(cur instanceof Konva.Stage)) {
    if (isKMLayoutRoot(cur)) root = cur;
    cur = cur.getParent();
  }
  root?._kmComputeLayout();
}

function read(node: Konva.Node): Measurement {
  const t = node.getAbsoluteTransform();
  const box = transformRect(t, localRect(node));
  const lined = node as Konva.Node & Partial<KMLayoutNode>;
  if (typeof lined._kmMeasureLines !== "function") return box;
  const lines = lined._kmMeasureLines().map((l) => ({
    ...transformRect(t, l.rect),
    ink: transformRect(t, l.ink),
    baseline: t.point({ x: l.rect.left, y: l.baseline }).y,
    range: l.range,
  }));
  return { ...box, lines };
}

/** The node's own local-space box: shapes report their self rect (origin-
 *  corrected for centered shapes), KM wrappers their layout box, and raw
 *  containers the union of their children. */
function localRect(node: Konva.Node): LayoutBox {
  if (node instanceof Konva.Shape) {
    const r = node.getSelfRect();
    return { left: r.x, top: r.y, width: r.width, height: r.height };
  }
  if (isKMLayoutNode(node)) {
    return { left: 0, top: 0, width: node.width(), height: node.height() };
  }
  const r = node.getClientRect({ relativeTo: node as Konva.Container });
  return { left: r.x, top: r.y, width: r.width, height: r.height };
}

function transformRect(t: Konva.Transform, r: LayoutBox): MeasuredRect {
  const pts = [
    t.point({ x: r.left, y: r.top }),
    t.point({ x: r.left + r.width, y: r.top }),
    t.point({ x: r.left, y: r.top + r.height }),
    t.point({ x: r.left + r.width, y: r.top + r.height }),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
```

Notes for the implementer:
- The single default `import Konva from "konva"` serves both the `instanceof`
  checks and the type positions — the style used throughout core.
- Shape check comes **before** the KM check on purpose: `FlexShape` wrappers
  (Circle etc.) are KM leaves whose local origin is their center — their
  `getSelfRect()` is correct where `(0,0,w,h)` would not be.
- `read()` compiles against the optional `_kmMeasureLines` hook added in
  Step 3; `Text` implements it in Task 4 (ink) — until then `lines` is simply absent.

- [ ] **Step 5: Export from `packages/core/src/index.ts`**

Insert alphabetically (after the `./layout/image.js` block):

```ts
export {
  measure,
  type Measurement,
  type MeasuredLine,
  type MeasuredRect,
  type MeasureOptions,
} from "./layout/measure.js";
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @smoove/core test`
Expected: all `measure — box path` tests PASS (the typewriter test exercises
`_kmRunFrame`'s tick path). Delete `packages/core/src/test/setup.test.ts` now —
the flex smoke case is subsumed by the hero-mask test.

### Task 4: Text ink metrics + `_kmMeasureLines`

**Files:**
- Create: `packages/core/src/layout/text/ink.ts`
- Modify: `packages/core/src/layout/text/text.ts`
- Test: `packages/core/src/layout/text/ink.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/layout/text/ink.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Composition, measure, Sequence, Text } from "../../index.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `ink-t${n}`,
    fps: 30,
    durationInFrames: 10,
    width: 800,
    height: 600,
  });
}

describe("measure — Text lines", () => {
  it("returns per-line rects, ink and baseline", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const t = new Text({
      x: 40,
      y: 60,
      width: 180,
      text: "Hello wonderful world of markers and masks",
      fontSize: 24,
    });
    seq.add(t);
    comp.add(seq);
    comp.setFrame(0);

    const m = measure(t);
    const lines = m.lines ?? [];
    expect(lines.length).toBeGreaterThan(1);

    let prevBottom = Number.NEGATIVE_INFINITY;
    for (const line of lines) {
      // Stage space: inside the wrapper placed at (40, 60).
      expect(line.x).toBeGreaterThanOrEqual(40);
      expect(line.y).toBeGreaterThanOrEqual(60);
      expect(line.width).toBeGreaterThan(0);
      // Lines stack downward without overlap.
      expect(line.y).toBeGreaterThanOrEqual(prevBottom - 0.5);
      prevBottom = line.y + line.height;
      // Ink is glyph-tight: never wider than the line box (± antialias slack),
      // and the baseline sits inside the ink's vertical extent.
      expect(line.ink.width).toBeLessThanOrEqual(line.width + 2);
      expect(line.baseline).toBeGreaterThan(line.ink.y);
      expect(line.baseline).toBeLessThanOrEqual(line.ink.y + line.ink.height + 0.5);
      // Ranges cover displayed chars in order.
      expect(line.range.end).toBeGreaterThan(line.range.start);
    }
  });

  it("ink rect brackets the rendered glyph pixels (pixel-bracket)", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const t = new Text({ x: 20, y: 20, text: "Hxg", fontSize: 48, fill: "#ffffff" });
    seq.add(t);
    comp.add(seq);
    comp.setFrame(0);
    seq.draw();

    const line = measure(t).lines?.[0];
    expect(line).toBeDefined();
    if (!line) return;

    type SkiaLayerCanvas = { _canvas: { getContext(k: "2d"): CanvasRenderingContext2D } };
    const ctx = (seq.getCanvas() as unknown as SkiaLayerCanvas)._canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, 800, 600);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < 600; y++) {
      for (let x = 0; x < 800; x++) {
        if ((img.data[(y * 800 + x) * 4 + 3] ?? 0) > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    expect(minX).toBeLessThan(Infinity); // something rendered

    const slack = 2.5; // antialiasing + metric rounding
    expect(line.ink.x).toBeLessThanOrEqual(minX + slack);
    expect(line.ink.y).toBeLessThanOrEqual(minY + slack);
    expect(line.ink.x + line.ink.width).toBeGreaterThanOrEqual(maxX - slack);
    expect(line.ink.y + line.ink.height).toBeGreaterThanOrEqual(maxY - slack);
    // ...and is actually tight, not just an over-approximation:
    expect(line.ink.x).toBeGreaterThanOrEqual(minX - 6);
    expect(line.ink.y).toBeGreaterThanOrEqual(minY - 6);
    expect(line.ink.x + line.ink.width).toBeLessThanOrEqual(maxX + 6);
    expect(line.ink.y + line.ink.height).toBeLessThanOrEqual(maxY + 6);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @smoove/core test`
Expected: FAIL — `m.lines` is `undefined` (no `_kmMeasureLines` on Text yet).

- [ ] **Step 3: Implement `ink.ts`**

`packages/core/src/layout/text/ink.ts`:

```ts
import Konva from "konva";

/** Konva.Text internals used for metric extraction (same pattern as text.ts). */
type KonvaTextMetricsSource = Konva.Text & {
  _getContextFont: () => string;
  measureSize: (s: string) => {
    width: number;
    fontBoundingBoxAscent?: number;
    fontBoundingBoxDescent?: number;
    actualBoundingBoxAscent?: number;
    actualBoundingBoxDescent?: number;
  };
};

export type LineInk = {
  /** Ink extent left/right of the line's draw start point (both >= 0). */
  left: number;
  right: number;
  /** Ink extent above/below the alphabetic baseline. */
  ascent: number;
  descent: number;
};

let scratch: CanvasRenderingContext2D | null = null;
function scratchCtx(): CanvasRenderingContext2D {
  if (!scratch) {
    // Konva.Util.createCanvasElement is patched by the skia backend on the
    // server, so this is a browser canvas or a skia canvas as appropriate.
    scratch = Konva.Util.createCanvasElement().getContext(
      "2d",
    ) as CanvasRenderingContext2D;
  }
  return scratch;
}

/**
 * The alphabetic baseline's y offset from the top of a line box. Mirrors
 * Konva 10.3 `Text._sceneFunc` (non-legacy): `(fontAscent − fontDescent) / 2
 * + lineH / 2`, with the font metrics of "M" (fontBoundingBox, falling back
 * to actualBoundingBox). Legacy rendering (middle baseline) and metric-less
 * environments fall back to `lineH / 2 + fontSize * 0.35` — approximate, and
 * paired with ink falling back to the line box.
 */
export function baselineOffset(text: Konva.Text, lineH: number): number {
  const src = text as KonvaTextMetricsSource;
  const legacy = (Konva as unknown as { legacyTextRendering?: boolean }).legacyTextRendering;
  if (!legacy) {
    const m = src.measureSize("M");
    const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
    if (ascent !== undefined && descent !== undefined) {
      return (ascent - descent) / 2 + lineH / 2;
    }
  }
  return lineH / 2 + text.fontSize() * 0.35;
}

/**
 * Measure a rendered line's glyph ink relative to its draw start point and
 * baseline. Returns `null` when `actualBoundingBox` metrics are unavailable
 * (caller falls back to the line box).
 */
export function measureLineInk(text: Konva.Text, line: string): LineInk | null {
  if (!line) return null;
  const ctx = scratchCtx();
  ctx.font = (text as KonvaTextMetricsSource)._getContextFont();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const ls = text.letterSpacing() || 0;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls}px`;
  }
  const m = ctx.measureText(line);
  if (
    m.actualBoundingBoxAscent === undefined ||
    m.actualBoundingBoxDescent === undefined ||
    m.actualBoundingBoxLeft === undefined ||
    m.actualBoundingBoxRight === undefined
  ) {
    return null;
  }
  return {
    left: m.actualBoundingBoxLeft,
    right: m.actualBoundingBoxRight,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
  };
}
```

- [ ] **Step 4: Implement `Text._kmMeasureLines` + sugar**

In `packages/core/src/layout/text/text.ts`, add imports:

```ts
import type { LocalMeasuredLine } from "../contract.js";
import { measure as measureNode, type Measurement, type MeasureOptions } from "../measure.js";
import { baselineOffset, measureLineInk } from "./ink.js";
```

and add after `_kmPlace` (the flex-integration section):

```ts
  /** Measure this node's stage-space bounds — see {@link measureNode}. */
  measure(opts?: MeasureOptions): Measurement {
    return measureNode(this, opts);
  }

  /** @internal — {@link KMLayoutNode}: per-rendered-line geometry for `measure()`. */
  _kmMeasureLines(): LocalMeasuredLine[] {
    const geo = this._geo;
    if (!geo) return [];
    const blOff = baselineOffset(this._text, geo.lineH);
    return geo.ranges.map((r, li) => {
      const x = geo.pad + this._alignOffset(geo, r.width);
      const y = geo.pad + li * geo.lineH;
      const rect = { left: x, top: y, width: r.width, height: geo.lineH };
      const baseline = y + blOff;
      const ink = measureLineInk(this._text, geo.chars.slice(r.start, r.end).join(""));
      return {
        rect,
        ink: ink
          ? {
              left: x - ink.left,
              top: baseline - ink.ascent,
              width: ink.left + ink.right,
              height: ink.ascent + ink.descent,
            }
          : { ...rect },
        baseline,
        range: { start: r.start, end: r.end },
      };
    });
  }
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @smoove/core test`
Expected: all PASS, including the pixel-bracket case. If the pixel test fails
on the vertical bounds only, the baseline math diverged from Konva's draw —
re-read `node_modules/.pnpm/konva@10.3.0/node_modules/konva/lib/shapes/Text.js:137-150`
before loosening tolerances (that's the failure this test exists to catch).

### Task 5: `measure()` sugar on the remaining wrappers + exports

**Files:**
- Modify: `packages/core/src/layout/flex/flex.ts`
- Modify: `packages/core/src/layout/block.ts`
- Modify: `packages/core/src/layout/image.ts`
- Modify: `packages/core/src/layout/flex/mixin.ts`
- Test: `packages/core/src/layout/measure.test.ts` (extend)

- [ ] **Step 1: Add the failing test**

Append to the `describe` block in `packages/core/src/layout/measure.test.ts`:

```ts
  it("exposes .measure() sugar on the wrappers", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const flex = new Flex({ x: 10, y: 10, flexDirection: "row" });
    const r = new Rect({ width: 20, height: 20, fill: "#0f0" });
    flex.add(r);
    seq.add(flex);
    comp.add(seq);
    comp.setFrame(0);
    expect(flex.measure()).toMatchObject({ x: 10, y: 10 });
    expect(r.measure().width).toBe(20);
    const t = new Text({ text: "hi", fontSize: 20 });
    seq.add(t);
    expect(t.measure().lines?.length).toBe(1);
  });
```

Run: `pnpm --filter @smoove/core test`
Expected: FAIL — `.measure` is not a function on Flex/Rect.

- [ ] **Step 2: Add the sugar**

The method body is identical in all four files; only the relative import path
differs. In each class add:

```ts
  /** Measure this node's stage-space bounds — see {@link measureNode}. */
  measure(opts?: MeasureOptions): Measurement {
    return measureNode(this, opts);
  }
```

with the import:

- `packages/core/src/layout/flex/flex.ts` and `packages/core/src/layout/flex/mixin.ts`:
  `import { measure as measureNode, type Measurement, type MeasureOptions } from "../measure.js";`
  (in `mixin.ts` the method goes inside the `Wrapped` class, and the returned
  constructor type becomes `N & KMLayoutNode & { measure(opts?: MeasureOptions): Measurement }`)
- `packages/core/src/layout/block.ts` and `packages/core/src/layout/image.ts`:
  `import { measure as measureNode, type Measurement, type MeasureOptions } from "./measure.js";`

- [ ] **Step 3: Run tests + full build**

Run: `pnpm --filter @smoove/core test && pnpm build`
Expected: tests PASS; the workspace build stays clean (player/studio/docs
consume core's public types — a leaked type error surfaces here).

### Task 6: Changeset, docs page + demo, skill rules

**Files:**
- Create: `.changeset/node-measure.md`
- Create: `packages/docs/src/demos/measure-reveal.ts`
- Create: `packages/docs/content/docs/measure.mdx`
- Modify: `packages/docs/content/docs/meta.json`
- Modify: `skills/smoove-video/rules/shapes.md`
- Modify: `.agents/skills/smoove-video/rules/shapes.md`

- [ ] **Step 1: Changeset** (pre-1.0 convention: additive feature = patch)

`.changeset/node-measure.md`:

```md
---
"@smoove/core": patch
---

Lifetime-independent measurement: `measure(node, { at? })` (also `.measure()` on every smoove wrapper) lays a node out on demand — even inside a sequence that has never been on screen — and returns its stage-space bounds. Pass `{ at }` to measure at any local frame of the owning sequence; active sequences are restored to their live frame afterwards. `Text` measurements include per-line rects, glyph-tight ink bounds, and the alphabetic baseline, so masks and underlines can anchor to real glyph edges.
```

- [ ] **Step 2: Demo — the hero-mask scenario**

`packages/docs/src/demos/measure-reveal.ts` (beat B opens a reveal from a flex
tile it measured in beat A — the scaffolding-free version of the workaround
this feature deletes):

```ts
import { Block, Composition, Flex, interpolate, measure, Rect, Sequence, Text } from "@smoove/core";

/**
 * Beat A lays out a row of flex tiles. Beat B — a separate sequence — opens a
 * spotlight ring from the middle tile's exact stage rect, obtained with
 * measure({ at }) even when the viewer seeks straight into beat B and beat A
 * never ran. No scaffolding sequence, no hand-copied coordinates.
 */
const width = 1280;
const height = 720;
const aLen = 90;
const bLen = 120;

const comp = new Composition({
  id: "measure-reveal",
  fps: 60,
  durationInFrames: aLen + bLen,
  width,
  height,
  loop: true,
});

const base = new Sequence();
base.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(base);

// Beat A: a centered row of tiles.
const beatA = new Sequence({ from: 0, durationInFrames: aLen });
const row = new Flex({ x: 190, y: 260, flexDirection: "row", gap: 30 });
const tiles = ["#1f6feb", "#bb8009", "#1a7f76"].map((fill, i) => {
  const tile = new Block({ width: 280, height: 200, background: fill, cornerRadius: 18 });
  tile.add(
    new Text({ text: `tile ${i + 1}`, fontSize: 32, fill: "#0d1117", margin: 20 }),
  );
  return tile;
});
for (const t of tiles) row.add(t);
beatA.add(row);
comp.add(beatA);

// Beat B: measure beat A's middle tile at its final frame, then spotlight it.
const beatB = new Sequence({ from: aLen, durationInFrames: bLen });
const ring = new Rect({ stroke: "#bc8cff", strokeWidth: 6, cornerRadius: 24 });
const label = new Text({
  x: 0,
  y: 80,
  width,
  align: "center",
  text: "measure(tile, { at: 89 }) — no scaffolding sequence",
  fontSize: 28,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fill: "#e6edf3",
});
beatB.add(ring);
beatB.add(label);
beatB.register((local) => {
  const target = tiles[1];
  if (!target) return;
  const m = measure(target, { at: aLen - 1 });
  const grow = interpolate(local, [0, 30], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  ring.setAttrs({
    x: m.x - 10 - grow,
    y: m.y - 10 - grow,
    width: m.width + 20 + grow * 2,
    height: m.height + 20 + grow * 2,
    opacity: interpolate(local, [0, 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  });
});
comp.add(beatB);

export default comp;
```

- [ ] **Step 3: Docs page**

**Invoke the `smoove-writing` skill before writing the page** (repo rule —
docs prose goes through it). Create `packages/docs/content/docs/measure.mdx`
covering, in this order: the lifetime problem (one paragraph), `measure(node)`
and `{ at }` with a code block, the `Measurement`/`MeasuredLine` shape, the
Text ink/baseline story (underline + mask anchoring), the live
`measure-reveal` demo embed (mirror the `<Demo>`/player embed pattern used by
`markers.mdx` exactly), and the font-readiness caveat (`await comp.whenReady()`).
Register the page in `packages/docs/content/docs/meta.json` after `"markers"`.

- [ ] **Step 4: Skill rules**

Append to `skills/smoove-video/rules/shapes.md` AND
`.agents/skills/smoove-video/rules/shapes.md` (keep both copies identical):

```md
## Measuring nodes

`measure(node)` (or `node.measure()` on any smoove wrapper) returns stage-space
bounds `{ x, y, width, height }`, laying the node out on demand — it works even
for sequences that haven't been on screen, so never keep a dead sequence alive
just to read geometry from it. Pass `{ at: localFrame }` to measure at a
specific frame of the node's own sequence (e.g. a previous beat's final frame).
`Text` results add `lines[]` with per-line `ink` rects and `baseline` — anchor
underlines to `baseline` and masks to `ink`, not to the box. Bounds are final
only once fonts are ready (`await comp.whenReady()`).
```

- [ ] **Step 5: Verify the demo in the browser**

Run: `pnpm build`, then start the docs dev server (Browser pane, launch config
`docs`, port 5176) and open `/docs/measure`. Verify:
- No new console errors (the pre-existing "Several Konva instances" spam is
  known and not this feature's).
- Seek the player straight into beat B (e.g. frame 150 via the scrub bar or
  `p._comp.setFrame(150)` + per-layer `draw()` from the console): the ring
  must wrap the middle tile exactly — that is the seek-without-beat-A case
  this feature exists for. Sample the ring stroke pixel (`#bc8cff`) from the
  layer canvas as done for the markers verification.

### Task 7: Full verification + parity checklist

- [ ] **Step 1: Whole-workspace checks**

Run: `pnpm --filter @smoove/core test && pnpm build && pnpm check`
Expected: tests PASS, build clean, biome clean (`pnpm format` first if needed).

- [ ] **Step 2: Server-render sanity**

Run: `pnpm --filter @smoove/renderer example` (the existing render-demo).
Expected: renders as before — proves the `_kmRunFrame` refactor didn't disturb
the offline path (`setFrame`/`renderFrame` driving, no `play()`).

- [ ] **Step 3: Walk the spec's parity checklist**

Confirm each item and note evidence in the session:
- setFrame-driven Node path: covered by the vitest suite itself (all tests
  drive `setFrame`, never `play()`).
- Frame-purity + restore: the restore test (Task 3).
- Fonts before frame 0: unchanged machinery; the docs page documents
  `whenReady()`.
- No media decode/seek at measure time: `_kmRunFrame(local, false)` skips
  media-only ticks (Task 2 code).

- [ ] **Step 4: Update the memory file**

Update `node-measure-design.md` in the memory directory: implementation
landed, where the tests live, and that core now has a vitest + skia rig other
features can use.
