# Design fidelity: test harness and papercuts implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans`
> to implement this plan task by task, inline in the main session. Steps use
> checkbox (`- [ ]`) syntax for tracking. Do not commit unless asked.

**Goal:** Make composition behaviour assertable from vitest, then fix the three
API papercuts that force composition authors to write engine code by hand.

**Architecture:** A new `@smoove/core/testing` subpath exports two functions.
`probe` walks a scene graph and reports, per node, what is actually on screen:
stage-space box, effective opacity, visibility, and resolved paint. `probeAt`
drives a `Composition` to a frame (or a time in seconds) and probes there.
Frame driving already works headless because core's vitest config loads
`konva/skia-backend`, so no new rendering path is needed. Phase 2 then fixes
`Text` font sizing, `Image` corner clamping, and the missing seeded RNG, each
with a test written against the harness or as a pure unit.

**Tech stack:** TypeScript, Konva, vitest, skia-canvas (via `konva/skia-backend`).

**Spec:** [2026-07-27-design-fidelity-gaps-design.md](../specs/2026-07-27-design-fidelity-gaps-design.md).
Phases 1 and 2 of that document. Phase 3 (the fills work) gets its own plan once
this one lands, because its tests are written against this harness.

---

## File structure

**Create:**

- `packages/core/src/testing/probe.ts`: the probe types, `probe`, `probeAt`,
  `countAt`. One responsibility, read scene state and never mutate it (beyond
  the frame `probeAt` is asked to drive to).
- `packages/core/src/testing/index.ts`: the public surface of the subpath.
- `packages/core/src/testing/probe.test.ts`: tests for the above.
- `packages/core/src/animation/random.ts`: the seeded generator.
- `packages/core/src/animation/random.test.ts`
- `packages/kitchen-sink/vitest.config.ts`: vitest wired with the smoove Vite
  plugin so real composition modules import directly.
- `packages/kitchen-sink/src/test/setup.ts`
- `packages/kitchen-sink/src/compositions/bouncing/composition.test.ts`: the
  first real-module test, proving the harness works on shipped code.

**Modify:**

- `packages/core/package.json`: add the `./testing` export.
- `packages/core/src/layout/block.ts`: add `_kmProbePaint`.
- `packages/core/src/layout/text/text.ts`: add `setFontSize` and `fontSize`.
- `packages/core/src/layout/image.ts`: clamp corner radii at draw time.
- `packages/core/src/index.ts`: export `random`.
- `packages/kitchen-sink/package.json`: add the `test` script and vitest.

---

## Phase 1: the harness

### Task 1: `probe` reports what is on screen at the current frame

**Files:**
- Create: `packages/core/src/testing/probe.ts`
- Test: `packages/core/src/testing/probe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/testing/probe.test.ts`:

```ts
import Konva from "konva";
import { describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { probe } from "./probe.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `probe-t${n}`,
    fps: 30,
    durationInFrames: 300,
    width: 320,
    height: 240,
  });
}

describe("probe", () => {
  it("reports stage-space box, effective opacity and name", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const group = new Konva.Group({ x: 10, y: 20, opacity: 0.5 });
    const rect = new Konva.Rect({ x: 5, y: 5, width: 40, height: 30, opacity: 0.5, name: "chip" });
    group.add(rect);
    seq.add(group);
    comp.add(seq);
    comp.setFrame(0);

    const [p] = probe(comp, ".chip");
    expect(p).toBeDefined();
    expect(p?.name).toBe("chip");
    expect(p?.box).toEqual({ x: 15, y: 25, width: 40, height: 30 });
    expect(p?.opacity).toBeCloseTo(0.25);
    expect(p?.visible).toBe(true);
  });

  it("marks a node inside an inactive sequence as not visible", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 50, durationInFrames: 10 });
    seq.add(new Konva.Rect({ width: 10, height: 10, name: "chip" }));
    comp.add(seq);
    comp.setFrame(0);

    const [p] = probe(comp, ".chip");
    expect(p?.visible).toBe(false);
  });

  it("marks a zero-opacity node as not visible", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Konva.Rect({ width: 10, height: 10, opacity: 0, name: "chip" }));
    comp.add(seq);
    comp.setFrame(0);

    expect(probe(comp, ".chip")[0]?.visible).toBe(false);
  });

  it("reports a shape's flat fill as paint", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Konva.Rect({ width: 10, height: 10, fill: "#FF2D3F", name: "chip" }));
    comp.add(seq);
    comp.setFrame(0);

    expect(probe(comp, ".chip")[0]?.paint).toEqual({ kind: "color", color: "#FF2D3F" });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @smoove/core exec vitest run src/testing/probe.test.ts
```

Expected: FAIL, cannot resolve `./probe.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/testing/probe.ts`:

```ts
import type Konva from "konva";
import type { QuerySelector } from "../engine/timeline.js";
import { measure, type MeasuredRect } from "../layout/measure.js";

/** The paint a node actually resolved to, as opposed to what was configured. */
export type Paint =
  | { kind: "color"; color: string }
  | { kind: "gradient"; stops: (number | string)[] }
  | undefined;

/** One node's on-screen state at the current frame. */
export type Probe = {
  node: Konva.Node;
  /** Konva `name()`, the handle a `.selector` matches on. Empty when unnamed. */
  name: string;
  /** Stage-space axis-aligned bounds, via {@link measure}. */
  box: MeasuredRect;
  /** Effective opacity with every ancestor folded in. */
  opacity: number;
  /**
   * Whether this node paints: it and every ancestor are visible (which covers
   * sequence gating, since an inactive `Sequence` sets `visible(false)`) and
   * effective opacity is above zero.
   */
  visible: boolean;
  paint: Paint;
};

/** A node that can report the paint it resolved to (implemented by `Block`). */
type PaintProbe = { _kmProbePaint: () => Paint };

function hasPaintProbe(node: unknown): node is PaintProbe {
  return typeof (node as PaintProbe)._kmProbePaint === "function";
}

function readPaint(node: Konva.Node): Paint {
  if (hasPaintProbe(node)) return node._kmProbePaint();
  const shape = node as Konva.Node & Partial<Konva.Shape>;
  if (typeof shape.fillLinearGradientColorStops === "function") {
    const stops =
      shape.fillLinearGradientColorStops() ?? shape.fillRadialGradientColorStops?.();
    if (stops && stops.length > 0) return { kind: "gradient", stops };
  }
  if (typeof shape.fill === "function") {
    const fill = shape.fill();
    if (fill) return { kind: "color", color: fill };
  }
  return undefined;
}

/**
 * Read the on-screen state of every node under `root` matching `selector`, at
 * whatever frame the composition currently sits on. Pair with
 * {@link probeAt} to drive the clock first.
 *
 * Read-only: nothing here mutates the scene.
 */
export function probe(
  root: { find: (selector: QuerySelector) => Konva.Node[] },
  selector: QuerySelector = () => true,
): Probe[] {
  return root.find(selector).map((node) => {
    const opacity = node.getAbsoluteOpacity();
    return {
      node,
      name: node.name() ?? "",
      box: measure(node),
      opacity,
      visible: node.isVisible() && opacity > 0,
      paint: readPaint(node),
    };
  });
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/core exec vitest run src/testing/probe.test.ts
```

Expected: PASS, 4 tests.

If the first test fails on `box`, `measure` returned the node's own rect rather
than a stage-space one. Read
`packages/core/src/layout/measure.ts:50` and fix the test's expectation only if
the source proves the expectation wrong, never the other way around.

---

### Task 2: `probeAt` drives the clock, by frame or by seconds

**Files:**
- Modify: `packages/core/src/testing/probe.ts`
- Test: `packages/core/src/testing/probe.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/testing/probe.test.ts`:

```ts
describe("probeAt", () => {
  it("drives the composition to a frame before probing", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const rect = new Konva.Rect({ width: 10, height: 10, name: "chip" });
    seq.add(rect);
    seq.register((frame) => rect.x(frame * 2));
    comp.add(seq);

    expect(probeAt(comp, 7, ".chip")[0]?.box.x).toBe(14);
  });

  it("accepts a time in seconds and rounds to the nearest frame", () => {
    const comp = makeComp(); // 30fps
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const rect = new Konva.Rect({ width: 10, height: 10, name: "chip" });
    seq.add(rect);
    seq.register((frame) => rect.x(frame));
    comp.add(seq);

    // 0.2s at 30fps is frame 6.
    expect(probeAt(comp, { time: 0.2 }, ".chip")[0]?.box.x).toBe(6);
  });

  it("counts only what is on screen", () => {
    const comp = makeComp();
    const early = new Sequence({ from: 0, durationInFrames: 5 });
    const late = new Sequence({ from: 0, durationInFrames: 300 });
    for (let i = 0; i < 3; i += 1) {
      early.add(new Konva.Rect({ width: 4, height: 4, name: "dot" }));
    }
    late.add(new Konva.Rect({ width: 4, height: 4, name: "dot" }));
    comp.add(early);
    comp.add(late);

    expect(countAt(comp, 0, ".dot")).toBe(4);
    expect(countAt(comp, { time: 6.0 }, ".dot")).toBe(1);
  });
});
```

Add `countAt` and `probeAt` to the import at the top of the file:

```ts
import { countAt, probe, probeAt } from "./probe.js";
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @smoove/core exec vitest run src/testing/probe.test.ts
```

Expected: FAIL, `probeAt is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `packages/core/src/testing/probe.ts`. Add the `Composition` import at the
top of the file:

```ts
import type { Composition } from "../engine/composition.js";
```

Then append:

```ts
/** A point on the timeline: a global frame, or a time in seconds. */
export type At = number | { time: number };

function toFrame(comp: Composition, at: At): number {
  return typeof at === "number" ? at : Math.round(at.time * comp.fps);
}

/**
 * Drive `comp` to `at` and probe there. This is the acceptance-criterion form:
 * a spec that says "26 on screen at 6.0s" becomes one assertion.
 *
 * The frame stays where it was driven to, so successive calls read as a
 * timeline walk rather than a set of independent probes.
 */
export function probeAt(comp: Composition, at: At, selector: QuerySelector = () => true): Probe[] {
  comp.setFrame(toFrame(comp, at));
  return probe(comp, selector);
}

/** How many matching nodes actually paint at `at`. */
export function countAt(comp: Composition, at: At, selector: QuerySelector = () => true): number {
  return probeAt(comp, at, selector).filter((p) => p.visible).length;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/core exec vitest run src/testing/probe.test.ts
```

Expected: PASS, 7 tests.

---

### Task 3: `Block` reports its resolved background

**Files:**
- Modify: `packages/core/src/layout/block.ts`
- Test: `packages/core/src/testing/probe.test.ts`

`Block` paints through an internal background `Rect`, so `readPaint` finds
nothing on the `Block` node itself. This is the hook that makes Phase 3's fill
work assertable.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/testing/probe.test.ts`, adding
`import { Block } from "../layout/block.js";` at the top:

```ts
describe("Block paint", () => {
  it("reports a flat background", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Block({ width: 50, height: 50, background: "#FF2D3F", name: "card" }));
    comp.add(seq);

    expect(probeAt(comp, 0, ".card")[0]?.paint).toEqual({ kind: "color", color: "#FF2D3F" });
  });

  it("reports a gradient background as its resolved stops", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(
      new Block({
        width: 50,
        height: 50,
        name: "card",
        background: {
          gradient: { type: "linear", angle: 90, stops: [[0, "#000"], [1, "#FFF"]] },
        },
      }),
    );
    comp.add(seq);

    expect(probeAt(comp, 0, ".card")[0]?.paint).toEqual({
      kind: "gradient",
      stops: [0, "#000", 1, "#FFF"],
    });
  });

  it("reports no paint for a background-less block", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Block({ width: 50, height: 50, name: "card" }));
    comp.add(seq);

    expect(probeAt(comp, 0, ".card")[0]?.paint).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @smoove/core exec vitest run src/testing/probe.test.ts
```

Expected: FAIL, `paint` is `undefined` for the first two cases.

- [ ] **Step 3: Write the implementation**

In `packages/core/src/layout/block.ts`, add a method to the `Block` class,
next to the other `_km`-prefixed internals:

```ts
  /**
   * @internal Testing probe: the paint the background rect actually resolved
   * to, which is not readable from the `Block` node itself because painting
   * happens on an internal child.
   */
  _kmProbePaint():
    | { kind: "color"; color: string }
    | { kind: "gradient"; stops: (number | string)[] }
    | undefined {
    const stops =
      this._bg.fillLinearGradientColorStops() ?? this._bg.fillRadialGradientColorStops();
    if (stops && stops.length > 0) return { kind: "gradient", stops };
    const fill = this._bg.fill();
    return fill ? { kind: "color", color: fill } : undefined;
  }
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/core exec vitest run src/testing/probe.test.ts
```

Expected: PASS, 10 tests.

The third case is the regression guard for the comment at
`packages/core/src/layout/block.ts:198`: an empty stops array reads as "has
fill" to Konva, so `_kmProbePaint` checks `length > 0` rather than truthiness.

---

### Task 4: Publish the harness as `@smoove/core/testing`

**Files:**
- Create: `packages/core/src/testing/index.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Write the entry point**

Create `packages/core/src/testing/index.ts`:

```ts
export {
  type At,
  countAt,
  type Paint,
  type Probe,
  probe,
  probeAt,
} from "./probe.js";
```

- [ ] **Step 2: Add the subpath export**

In `packages/core/package.json`, replace the `exports` block with:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "import": "./dist/testing/index.js"
    }
  },
```

- [ ] **Step 3: Build and confirm the subpath resolves**

```bash
pnpm --filter @smoove/core build
```

Expected: exit 0, and `packages/core/dist/testing/index.js` exists.

```bash
ls packages/core/dist/testing/
```

Expected: `index.d.ts`, `index.js`, `probe.d.ts`, `probe.js`.

- [ ] **Step 4: Run the whole core suite**

```bash
pnpm --filter @smoove/core test
```

Expected: PASS, no regressions.

---

### Task 5: Test a real composition module

**Files:**
- Create: `packages/kitchen-sink/vitest.config.ts`
- Create: `packages/kitchen-sink/src/test/setup.ts`
- Create: `packages/kitchen-sink/src/compositions/bouncing/composition.test.ts`
- Modify: `packages/kitchen-sink/package.json`

Synthetic scenes built inline prove the harness works. They do not prove a
shipped composition works. Kitchen-sink composition modules expect the smoove
Vite plugin, and vitest is Vite, so the plugin goes straight into a vitest
config and the modules import directly.

- [ ] **Step 1: Add the vitest config**

Create `packages/kitchen-sink/vitest.config.ts`:

```ts
import { smoove } from "@smoove/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The smoove plugin rewrites media imports so they resolve in Node too,
  // which is what lets a composition module import assets under vitest.
  plugins: [smoove()],
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Add the setup file**

Create `packages/kitchen-sink/src/test/setup.ts`:

```ts
// Same backend the renderer uses, so a composition ticks against the real
// server code path rather than a mock canvas.
import "konva/skia-backend";
```

- [ ] **Step 3: Add the test script**

In `packages/kitchen-sink/package.json`, add to `scripts`:

```json
    "test": "vitest run",
```

and to `devDependencies`:

```json
    "vitest": "^3.2.4",
```

Then install:

```bash
pnpm install
```

- [ ] **Step 4: Write the failing test**

`bouncing` is the right first subject: it loads no assets, so nothing here
depends on the network, and the ball's position is a closed-form function of
the frame, so the assertions are real acceptance criteria rather than
smoke tests. It runs at 60fps and default-exports the built `Composition`
(`packages/kitchen-sink/src/compositions/bouncing/composition.ts:95`).

The expected numbers come from the composition's own updater. `height` is 720,
so `groundY` is 660, `minY` is 80 and `maxY` is 630. At frame 0 the triangle
wave `u` is 0, so the ball sits at `minY`. At frame 30, `t` is 0.5, `u` is 0.5,
`eased` is `1 - 0.5²` = 0.75, so the ball sits at `80 + 550 × 0.75` = 492.5. The
circle's radius is 30 and squash only kicks in above `u` 0.85, so the box is
60 by 60 at both frames.

Create `packages/kitchen-sink/src/compositions/bouncing/composition.test.ts`:

```ts
import { probeAt } from "@smoove/core/testing";
import { describe, expect, it } from "vitest";
import comp from "./composition.js";

describe("bouncing composition", () => {
  it("fills the frame with the ground colour", async () => {
    await comp.whenReady();
    const [bg] = probeAt(comp, 0, "Rect");
    expect(bg?.box).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(bg?.paint).toEqual({ kind: "color", color: "#0d1117" });
  });

  it("drops the ball from its start height to the eased midpoint", async () => {
    await comp.whenReady();

    const start = probeAt(comp, 0, "Circle")[0];
    expect(start?.visible).toBe(true);
    expect(start?.box).toEqual({ x: 610, y: 50, width: 60, height: 60 });

    const mid = probeAt(comp, 30, "Circle")[0];
    expect(mid?.box.y).toBeCloseTo(462.5, 3);
  });
});
```

- [ ] **Step 5: Run it**

```bash
pnpm --filter @smoove/kitchen-sink test
```

Expected: PASS, 2 tests.

If it fails on an unresolved import, the smoove plugin is not seeing the module.
Check that `plugins: [smoove()]` is in the vitest config and not only in
`vite.config.ts`. If the box assertions are off by the stroke width, `measure`
is reporting the stroked bounds; read what `getSelfRect` returns for a stroked
`Konva.Circle` and correct the expectation to match the source, never the other
way around.

- [ ] **Step 6: Confirm the harness catches a real regression**

Change `radius: 30` to `radius: 40` in
`packages/kitchen-sink/src/compositions/bouncing/composition.ts:29`, re-run, and
confirm the box assertion fails with the 80 by 80 box. Then revert. A harness
nobody has seen fail is not a harness.

---

## Phase 2: papercuts

### Task 6: `Text.setFontSize` and `Text.fontSize`

**Files:**
- Modify: `packages/core/src/layout/text/text.ts`
- Test: `packages/core/src/layout/text/text-size.test.ts` (create)

Resizing text after construction currently means destroying the node and
rebuilding it, plus tracking the size in composition state, because nothing
reads it back. The internals already resize (`_applyFit` calls
`this._text.fontSize(fs)` at `text.ts:499`) and already cache the result in
`_resolvedFontSize`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/layout/text/text-size.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Composition } from "../../engine/composition.js";
import { Sequence } from "../../engine/sequence.js";
import { Text } from "./text.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `text-size-t${n}`,
    fps: 30,
    durationInFrames: 100,
    width: 400,
    height: 200,
  });
}

describe("Text font size", () => {
  it("reads back the size it renders at", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const text = new Text({ text: "Hello", fontSize: 48 });
    seq.add(text);
    comp.add(seq);

    expect(text.fontSize()).toBe(48);
  });

  it("resizes in place and re-lays-out", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const text = new Text({ text: "Hello", fontSize: 48 });
    seq.add(text);
    comp.add(seq);
    const wide = text.width();

    text.setFontSize(24);

    expect(text.fontSize()).toBe(24);
    expect(text.width()).toBeLessThan(wide);
  });

  it("reports the fitted size, not the requested one, when fitText is set", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const text = new Text({
      text: "A very long line of text that cannot fit at the requested size",
      width: 100,
      fontSize: 200,
      fitText: { min: 8, max: 200 },
    });
    seq.add(text);
    comp.add(seq);

    expect(text.fontSize()).toBeLessThan(200);
    expect(text.fontSize()).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @smoove/core exec vitest run src/layout/text/text-size.test.ts
```

Expected: FAIL, `text.fontSize is not a function`.

- [ ] **Step 3: Write the implementation**

In `packages/core/src/layout/text/text.ts`, add both methods immediately after
`setFill` (around line 227):

```ts
  /**
   * The size the glyphs actually render at. With `fitText` this is the fitted
   * size, not the configured one, which is what a caller measuring a plate
   * needs to know.
   */
  fontSize(): number {
    return this._resolvedFontSize;
  }

  /**
   * Resize the glyphs after construction. Font size IS a layout input, so this
   * re-runs fit + clamp + layout, unlike {@link setFill}.
   *
   * With `fitText` configured the fit still wins: this sets the size the search
   * starts from, and {@link fontSize} reports where it landed.
   */
  setFontSize(size: number): this {
    this._text.fontSize(size);
    this._layoutText();
    this.getLayer()?.batchDraw();
    return this;
  }
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/core exec vitest run src/layout/text/text-size.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full core suite**

```bash
pnpm --filter @smoove/core test
```

Expected: PASS. If `fontSize()` collides with an inherited Konva accessor, the
suite is where that surfaces.

---

### Task 7: `Image.cornerRadius` clamps like CSS

**Files:**
- Modify: `packages/core/src/layout/image.ts`
- Test: `packages/core/src/layout/image-corners.test.ts` (create)

`cornerRadius: 9999` on a square is the standard way to ask for a disc. Today
it renders a squircle, because `normalizeCorners` (`image.ts:247`) passes radii
through unclamped and `roundRectPath` draws them raw.

The clamp has to happen inside the `clipFunc`, not in `normalizeCorners`:
`normalizeCorners` runs in the constructor, before flex has sized the node, so
it has no width or height to clamp against.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/layout/image-corners.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampCorners } from "./image.js";

describe("clampCorners", () => {
  it("leaves radii that already fit alone", () => {
    expect(clampCorners([10, 10, 10, 10], 100, 100)).toEqual([10, 10, 10, 10]);
  });

  it("turns an oversized uniform radius into a disc on a square", () => {
    expect(clampCorners([9999, 9999, 9999, 9999], 100, 100)).toEqual([50, 50, 50, 50]);
  });

  it("clamps against the shortest edge on a non-square box", () => {
    expect(clampCorners([9999, 9999, 9999, 9999], 200, 100)).toEqual([50, 50, 50, 50]);
  });

  it("scales every radius by one common factor, not just the offender", () => {
    // Top edge needs 100/(80+40) = 0.8333…, and that factor applies to all four.
    const [tl, tr, br, bl] = clampCorners([80, 40, 0, 0], 100, 1000);
    expect(tl).toBeCloseTo(66.667, 3);
    expect(tr).toBeCloseTo(33.333, 3);
    expect(br).toBe(0);
    expect(bl).toBe(0);
  });

  it("handles a zero-size box without dividing by zero", () => {
    expect(clampCorners([10, 10, 10, 10], 0, 0)).toEqual([0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @smoove/core exec vitest run src/layout/image-corners.test.ts
```

Expected: FAIL, `clampCorners` is not exported.

- [ ] **Step 3: Write the implementation**

In `packages/core/src/layout/image.ts`, add next to `normalizeCorners`:

```ts
/**
 * CSS's corner-overflow rule (CSS Backgrounds 3, section 5.5): when the two
 * radii sharing an edge sum to more than that edge, every radius scales by the
 * smallest ratio needed to fit. Scaling all four rather than only the offender
 * is what keeps the silhouette proportional, and it is why `cornerRadius: 9999`
 * on a square yields a disc instead of a squircle.
 *
 * @internal exported for testing.
 */
export function clampCorners(r: number[], w: number, h: number): number[] {
  const [tl = 0, tr = 0, br = 0, bl = 0] = r;
  const ratio = (edge: number, a: number, b: number): number =>
    a + b > 0 ? edge / (a + b) : Number.POSITIVE_INFINITY;
  const f = Math.min(
    1,
    ratio(w, tl, tr),
    ratio(w, bl, br),
    ratio(h, tl, bl),
    ratio(h, tr, br),
  );
  return f < 1 ? [tl * f, tr * f, br * f, bl * f] : [tl, tr, br, bl];
}
```

Then change the `clipFunc` in the constructor (currently `image.ts:113-115`)
from:

```ts
    if (config.cornerRadius !== undefined) {
      const cr = normalizeCorners(config.cornerRadius);
      this.clipFunc((ctx) => roundRectPath(ctx, 0, 0, this.width(), this.height(), cr));
    }
```

to:

```ts
    if (config.cornerRadius !== undefined) {
      const cr = normalizeCorners(config.cornerRadius);
      // Clamp here, not in normalizeCorners: the constructor runs before flex
      // has sized the node, so width/height are only known at draw time.
      this.clipFunc((ctx) => {
        const w = this.width();
        const h = this.height();
        roundRectPath(ctx, 0, 0, w, h, clampCorners(cr, w, h));
      });
    }
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/core exec vitest run src/layout/image-corners.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full core suite**

```bash
pnpm --filter @smoove/core test
```

Expected: PASS.

---

### Task 8: A seeded RNG in core

**Files:**
- Create: `packages/core/src/animation/random.ts`
- Create: `packages/core/src/animation/random.test.ts`
- Modify: `packages/core/src/index.ts`

`Math.random` breaks frame purity and is correctly banned. Core ships no
replacement, so nine kitchen-sink compositions each hand-roll a generator with
their own constants. This is a small function that every composition needs.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/animation/random.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { random } from "./random.js";

describe("random", () => {
  it("is deterministic for a numeric seed", () => {
    const a = random(42);
    const b = random(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("is deterministic for a string seed", () => {
    const a = random("balloons");
    const b = random("balloons");
    expect(a()).toBe(b());
  });

  it("gives different streams for different seeds", () => {
    expect(random(1)()).not.toBe(random(2)());
    expect(random("a")()).not.toBe(random("b")());
  });

  it("stays inside [0, 1)", () => {
    const r = random(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range() stays inside its bounds", () => {
    const r = random(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = r.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it("int() is inclusive on both ends and hits both", () => {
    const r = random(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) seen.add(r.int(0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("pick() returns a member of the array", () => {
    const r = random(7);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(r.pick(items));
    }
  });

  it("pick() throws on an empty array rather than returning undefined", () => {
    expect(() => random(7).pick([])).toThrow("random: pick() needs a non-empty array");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @smoove/core exec vitest run src/animation/random.test.ts
```

Expected: FAIL, cannot resolve `./random.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/animation/random.ts`:

```ts
/** A seeded generator: call it for a float in `[0, 1)`, or use the helpers. */
export type Random = {
  (): number;
  /** A float in `[min, max)`. */
  range(min: number, max: number): number;
  /** An integer in `[min, max]`, both ends inclusive. */
  int(min: number, max: number): number;
  /** A uniformly chosen member of `items`. */
  pick<T>(items: readonly T[]): T;
};

/** Hash a string seed to a 32-bit integer so `random("balloons")` works. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A seeded pseudo-random generator (mulberry32). `Math.random` breaks frame
 * purity, so a composition that needs scatter seeds one of these instead and
 * gets the same sequence on every run, in the browser and on the server.
 *
 * ```ts
 * const r = random("confetti");
 * const x = r.range(0, comp.width());
 * const tint = r.pick(["#FF2D3F", "#FFC53D"]);
 * ```
 *
 * A generator is stateful: it walks its sequence as you call it. Seed one per
 * thing you are scattering, and seed it outside the frame updater, or reseed
 * it at the top of each frame. A generator advanced inside an updater produces
 * different values on a seek than on playback.
 */
export function random(seed: number | string): Random {
  let state = (typeof seed === "number" ? seed >>> 0 : hashSeed(seed)) || 1;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const r = next as Random;
  r.range = (min, max) => min + next() * (max - min);
  r.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  r.pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("random: pick() needs a non-empty array");
    return items[Math.floor(next() * items.length)] as T;
  };
  return r;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/core exec vitest run src/animation/random.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Export it**

In `packages/core/src/index.ts`, add next to the other `animation/` exports at
the top of the file:

```ts
export { type Random, random } from "./animation/random.js";
```

- [ ] **Step 6: Build and run the full suite**

```bash
pnpm --filter @smoove/core build && pnpm --filter @smoove/core test
```

Expected: exit 0, all tests pass.

---

## Wrap-up

- [ ] **Run every package's tests and typecheck**

```bash
pnpm -r test
```

```bash
pnpm -r typecheck
```

Expected: pass. Kitchen-sink has pre-existing typecheck failures unrelated to
this work; compare against `git stash` output rather than assuming any failure
is new.

- [ ] **Add a changeset**

```bash
pnpm changeset
```

`@smoove/core` gets a **patch** (additive features are patch while pre-1.0).
Summary: "Add `@smoove/core/testing` probes, `Text.setFontSize`, CSS corner
clamping on `Image`, and a seeded `random`."

- [ ] **Report and stop**

Do not commit. Summarise what landed and what the numbers were, then hand back
for review.

---

## Not in this plan

Phase 3 of the spec, the fills work: layered backgrounds, CSS-correct gradient
geometry, conic and repeating gradients, elliptical per-corner radii, gradient
text, per-side and gradient borders, clipping on `Block`, and masks. That plan
gets written after this one lands, because every one of its tasks asserts
through `probeAt` and `_kmProbePaint`, and those need to exist first.

Migrating the nine kitchen-sink compositions off their hand-rolled generators
onto `random` is also out of scope here. Task 8 ships the function; the
migration is mechanical and belongs in its own pass.
