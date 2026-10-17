# Layout Conformance Suite Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This repo forbids subagent-driven execution and forbids committing — see "House rules" below.

**Goal:** Build one corpus of ~80 small fixture compositions that both tests smoove's Flex/Block layout end to end (geometry + skia-rendered pixels) and generates a capability report showing every CSS-flex-like ability with code and a rendered example.

**Architecture:** Each ability is a `LayoutCase` object holding a `build(root)` function and an `expect(probe)` function. One harness runs a case: builds a `Composition`, drives the clock, measures stage-space boxes, rasterizes through `comp.captureCanvas()` (the skia backend the server renderer uses), samples named pixels, and captures a PNG data URI. `conformance.test.ts` iterates the corpus and asserts; the same run writes `out/report.html` from the same results, with `build.toString()` as the displayed code so the report can never drift from what ran.

**Tech Stack:** TypeScript, vitest 3, `konva/skia-backend` (already core's test setup), flexily 0.7.1 under `@smoove/core`'s Flex/Block.

**Spec:** [docs/superpowers/specs/2026-08-10-layout-conformance-design.md](../specs/2026-08-10-layout-conformance-design.md)

## House rules (override the generic workflow)

- **Never run `git commit` or `git push`.** `AGENTS.md` is explicit about this. Where a generic plan would say "commit", this plan says **Checkpoint**: run the suite, confirm it is green, leave the changes in the working tree.
- **No subagents.** Implement every task inline in the main session.
- Run `pnpm check` (Biome) before each checkpoint; the repo has no per-package Biome config, so run it from the repo root with explicit paths.

## Conformance, not change detection

Every expected number in this plan was derived by hand from CSS flexbox rules, not read out of smoove. **Some cases are expected to fail on the first run.** That is the point. Triage each failure into exactly one of:

- **smoove bug** — fix it in `packages/core/src/layout/`.
- **flexily bug** — work around it in `flex/flex.ts` with a comment naming flexily 0.7.1, the way `fixNaNCross` already does, and set `divergence` on the case so the report explains it.
- **deliberate divergence** — canvas-specific behaviour smoove chooses on purpose. Set `divergence` with the reason.

Never delete a failing case, and never rewrite an expected number to match what smoove printed.

---

## File structure

```
packages/core/conformance/            (beside src/, so nothing ships in dist/)
  types.ts             LayoutCase, CaseProbe, CaseResult
  harness.ts           runCase: build, drive, measure, rasterize, sample
  corpus.ts            the flat array, assembled from cases/
  cases/
    main-axis.ts       24 cases: 4 flexDirection x 6 justifyContent
    cross-axis.ts      13 cases: alignItems x 2 directions, alignSelf
    sizing.ts           8 cases: px, %, hug, grow, shrink, basis
    spacing.ts          9 cases: gap, padding notations, margin
    block-paint.ts     10 cases: background, gradients, borders, radius, shadow
    nesting.ts          6 cases: nesting depth, % vs hug, the fixNaNCross case
    text.ts             6 cases: wrap, hug, fitText, maxLines, row vs column
    leaves.ts           6 cases: Circle/Star/Image/raw Konva, invisible child
    reflow.ts           5 cases: animated gap, grow, width, visibility, text
  report.ts            writeReport(results) -> out/report.html
  conformance.test.ts  iterates the corpus, asserts, writes the report
  out/                 gitignored
packages/core/tsconfig.conformance.json   typechecks the folder without emitting
```

`conformance/` sits beside `src/` because `packages/core/tsconfig.json` has `"include": ["src"]` with `outDir: dist` — anything under `src` ships to consumers. vitest picks up `conformance/conformance.test.ts` with no config change, since its default include pattern is package-root-relative.

---

## Task 1: Harness and smoke case

**Files:**
- Create: `packages/core/conformance/types.ts`
- Create: `packages/core/conformance/harness.ts`
- Create: `packages/core/conformance/cases/main-axis.ts`
- Create: `packages/core/conformance/corpus.ts`
- Create: `packages/core/conformance/conformance.test.ts`
- Create: `packages/core/tsconfig.conformance.json`
- Modify: `packages/core/package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write `types.ts`**

```ts
import type Konva from "konva";
import type { Block } from "../src/index.js";

/** A stage-space axis-aligned rectangle. */
export type Rect = { x: number; y: number; width: number; height: number };

/** What a case's `expect` function gets to interrogate. */
export type CaseProbe = {
  /** Stage-space box of the first node matching a Konva selector (`.name`, `#id`, `Type`). */
  box(selector: string): Rect;
  /** Stage-space boxes of every match, in tree order. */
  boxes(selector: string): Rect[];
  /** The first matching node, for anything the probe does not cover. */
  node(selector: string): Konva.Node;
  /** The rendered pixel at a stage coordinate, as `#rrggbb` or `"transparent"`. */
  at(x: number, y: number): string;
  /** Assert a rendered pixel, with a tolerance for antialiasing (default 6/255 per channel). */
  expectColor(x: number, y: number, hex: string, tolerance?: number): void;
};

export type LayoutCase = {
  /** Stable kebab-case id, unique across the corpus. Used as the report anchor. */
  id: string;
  /** Report section, e.g. "Main axis". */
  group: string;
  /** Card heading, e.g. `justifyContent: "space-between"`. */
  title: string;
  /** One line of prose for the report card. */
  note: string;
  /** Canvas size. Default [480, 240]. Keep small: cost is per pixel. */
  size?: [number, number];
  /** Builds the scene into a root Block already sized to the canvas. Shown verbatim in the report. */
  build: (root: Block) => void;
  /** Frames to assert at. Default [1]. */
  frames?: number[];
  /** Assertions. Throwing (via vitest `expect`) records a failure; it does not abort the run. */
  expect: (probe: CaseProbe, frame: number) => void;
  /**
   * Set when this case knowingly diverges from CSS (a flexily workaround or a
   * deliberate canvas-specific choice). Rendered as a badge in the report.
   */
  divergence?: string;
};

export type CaseResult = {
  case: LayoutCase;
  /** PNG data URI of the last asserted frame. */
  png: string;
  /** Every named node's stage-space box at the last asserted frame. */
  geometry: Record<string, Rect>;
  /** Dedented `build.toString()` — the code the report shows. */
  source: string;
  /** Empty when the case passed. */
  failures: string[];
};
```

- [ ] **Step 2: Write `harness.ts`**

```ts
import type Konva from "konva";
import { Block, Composition, measure, Sequence } from "../src/index.js";
import { probe as probeAll } from "../src/testing/index.js";
import type { CaseProbe, CaseResult, LayoutCase, Rect } from "./types.js";

const DEFAULT_SIZE: [number, number] = [480, 240];

/** The page behind every case. Distinct from any case colour so probes can tell them apart. */
export const PAGE_BG = "#101820";

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * `build.toString()` keeps the indentation of the source file it came from.
 * Strip the smallest common indent off every line after the first so the
 * report shows the code at column zero.
 */
export function dedent(src: string): string {
  const lines = src.split("\n");
  const rest = lines.slice(1).filter((l) => l.trim().length > 0);
  const indent = rest.reduce((min, l) => Math.min(min, l.length - l.trimStart().length), 80);
  return [lines[0], ...lines.slice(1).map((l) => l.slice(indent))].join("\n").trim();
}

function makeProbe(comp: Composition, pixels: Uint8ClampedArray, width: number): CaseProbe {
  const find = (selector: string): Konva.Node[] => comp.find(selector);
  const rect = (node: Konva.Node): Rect => {
    const m = measure(node);
    return { x: m.x, y: m.y, width: m.width, height: m.height };
  };
  const at = (x: number, y: number): string => {
    const i = (Math.round(y) * width + Math.round(x)) * 4;
    const a = pixels[i + 3] ?? 0;
    if (a === 0) return "transparent";
    return toHex(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0);
  };
  return {
    box(selector) {
      const node = find(selector)[0];
      if (!node) throw new Error(`no node matched ${selector}`);
      return rect(node);
    },
    boxes(selector) {
      return find(selector).map(rect);
    },
    node(selector) {
      const node = find(selector)[0];
      if (!node) throw new Error(`no node matched ${selector}`);
      return node;
    },
    at,
    expectColor(x, y, hex, tolerance = 6) {
      const got = at(x, y);
      if (got === "transparent") {
        throw new Error(`pixel (${x},${y}) is transparent, expected ${hex}`);
      }
      const [er, eg, eb] = parseHex(hex);
      const [gr, gg, gb] = parseHex(got);
      const off = Math.max(Math.abs(er - gr), Math.abs(eg - gg), Math.abs(eb - gb));
      if (off > tolerance) {
        throw new Error(`pixel (${x},${y}) is ${got}, expected ${hex} (off by ${off})`);
      }
    },
  };
}

/**
 * Build, drive, assert, and capture one case. Never throws on an assertion
 * failure — failures land in `result.failures` so the report shows every case,
 * including the red ones.
 */
export async function runCase(c: LayoutCase): Promise<CaseResult> {
  const [w, h] = c.size ?? DEFAULT_SIZE;
  const frames = c.frames ?? [1];
  const comp = new Composition({
    id: `conformance-${c.id}`,
    fps: 30,
    durationInFrames: Math.max(...frames) + 1,
    width: w,
    height: h,
  });
  const seq = new Sequence();
  comp.add(seq);
  const root = new Block({ x: 0, y: 0, width: w, height: h, background: PAGE_BG });
  seq.add(root);
  c.build(root);
  await comp.whenReady();

  const failures: string[] = [];
  let png = "";
  let geometry: Record<string, Rect> = {};

  for (const frame of frames) {
    comp.setFrame(frame);
    const canvas = comp.captureCanvas();
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error("captureCanvas returned a canvas with no 2d context");
    const pixels = ctx.getImageData(0, 0, w, h).data;
    try {
      c.expect(makeProbe(comp, pixels, w), frame);
    } catch (err) {
      failures.push(`frame ${frame}: ${(err as Error).message}`);
    }
    geometry = {};
    for (const p of probeAll(comp, (n) => Boolean(n.name()))) {
      geometry[p.name] = { x: p.box.x, y: p.box.y, width: p.box.width, height: p.box.height };
    }
    png = (canvas as unknown as { toDataURL(type?: string): string }).toDataURL("image/png");
  }

  return { case: c, png, geometry, source: dedent(c.build.toString()), failures };
}
```

- [ ] **Step 3: Write two smoke cases in `cases/main-axis.ts`**

Container 480x240 holding three 100x60 blocks. Row free space is 480 - 300 = 180.

```ts
import { Block } from "../../src/index.js";
import type { LayoutCase } from "../types.js";

/** Three identical 100x60 tiles — the fixture every main-axis case shares. */
export function tiles(root: Block): void {
  root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
  root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
  root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
}

export const mainAxisCases: LayoutCase[] = [
  {
    id: "row-flex-start",
    group: "Main axis",
    title: 'flexDirection: "row", justifyContent: "flex-start"',
    note: "Items pack against the left edge in source order.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", justifyContent: "flex-start" });
      tiles(root);
    },
    expect: (p) => {
      expect(p.box(".a").x).toBe(0);
      expect(p.box(".b").x).toBe(100);
      expect(p.box(".c").x).toBe(200);
      expect(p.box(".a").y).toBe(0);
    },
  },
  {
    id: "row-space-between",
    group: "Main axis",
    title: 'flexDirection: "row", justifyContent: "space-between"',
    note: "First item at the start edge, last at the end edge, free space split evenly between.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", justifyContent: "space-between" });
      tiles(root);
    },
    expect: (p) => {
      expect(p.box(".a").x).toBe(0);
      expect(p.box(".b").x).toBe(190);
      expect(p.box(".c").x).toBe(380);
    },
  },
];
```

Add the vitest import at the top of the file: `import { expect } from "vitest";`

- [ ] **Step 4: Write `corpus.ts`**

```ts
import { mainAxisCases } from "./cases/main-axis.js";
import type { LayoutCase } from "./types.js";

export const corpus: LayoutCase[] = [...mainAxisCases];
```

- [ ] **Step 5: Write `conformance.test.ts`**

```ts
import { afterAll, describe, expect, it } from "vitest";
import { corpus } from "./corpus.js";
import { runCase } from "./harness.js";
import { writeReport } from "./report.js";
import type { CaseResult } from "./types.js";

const results: CaseResult[] = [];

it("has a unique id per case", () => {
  const ids = corpus.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
});

for (const group of [...new Set(corpus.map((c) => c.group))]) {
  describe(group, () => {
    for (const c of corpus.filter((x) => x.group === group)) {
      it(c.title, async () => {
        const result = await runCase(c);
        results.push(result);
        expect(result.failures).toEqual([]);
      });
    }
  });
}

afterAll(async () => {
  await writeReport(results);
});
```

`writeReport` does not exist yet (Task 11). Until then, stub it so the suite runs — create `packages/core/conformance/report.ts` with:

```ts
import type { CaseResult } from "./types.js";

export async function writeReport(_results: CaseResult[]): Promise<void> {
  // Filled in by Task 11.
}
```

- [ ] **Step 6: Run the suite to see it pass**

```bash
pnpm --filter @smoove/core exec vitest run conformance
```

Expected: 3 tests pass (`has a unique id per case`, plus the two Main axis cases).

If either main-axis case fails, do not change the expected numbers — they are CSS. Triage per "Conformance, not change detection" above.

- [ ] **Step 7: Add the typecheck project `packages/core/tsconfig.conformance.json`**

`tsconfig.base.json` sets `composite: true` and `declaration: true`, both of which conflict with `noEmit`, so override them.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "types": ["vitest/globals", "node"]
  },
  "include": ["conformance"]
}
```

- [ ] **Step 8: Add scripts to `packages/core/package.json`**

In the `scripts` block, alongside the existing `test`:

```json
"test:conformance": "vitest run conformance",
"test:conformance:types": "tsc -p tsconfig.conformance.json"
```

- [ ] **Step 9: Gitignore the report output**

Append to `.gitignore`:

```
# Generated layout conformance report
packages/core/conformance/out/
```

- [ ] **Step 10: Verify the typecheck project**

```bash
pnpm --filter @smoove/core run test:conformance:types
```

Expected: exits 0 with no output. If `@types/node` is missing, add it as a devDependency of `packages/core` and re-run.

- [ ] **Step 11: Checkpoint**

```bash
pnpm --filter @smoove/core run test:conformance && pnpm check packages/core/conformance
```

Expected: tests pass, Biome reports no diagnostics. Leave the changes in the working tree — do not commit.

---

## Task 2: Main axis (24 cases)

**Files:**
- Modify: `packages/core/conformance/cases/main-axis.ts`

Container 480x240, three 100x60 tiles, no gap, no padding.
Row main-axis free space: 480 - 300 = 180. Column: 240 - 180 = 60.

Reverse directions pack from the opposite edge: `row-reverse` + `flex-start` puts the **first** item at the **right** edge.

- [ ] **Step 1: Fill in the row table**

| justifyContent | a.x | b.x | c.x |
| --- | --- | --- | --- |
| flex-start | 0 | 100 | 200 |
| center | 90 | 190 | 290 |
| flex-end | 180 | 280 | 380 |
| space-between | 0 | 190 | 380 |
| space-around | 30 | 190 | 350 |
| space-evenly | 45 | 190 | 335 |

All six have `a.y === b.y === c.y === 0` (default `alignItems: "flex-start"`).

- [ ] **Step 2: Fill in the row-reverse table**

| justifyContent | a.x | b.x | c.x |
| --- | --- | --- | --- |
| flex-start | 380 | 280 | 180 |
| center | 290 | 190 | 90 |
| flex-end | 200 | 100 | 0 |
| space-between | 380 | 190 | 0 |
| space-around | 350 | 190 | 30 |
| space-evenly | 335 | 190 | 45 |

- [ ] **Step 3: Fill in the column table**

| justifyContent | a.y | b.y | c.y |
| --- | --- | --- | --- |
| flex-start | 0 | 60 | 120 |
| center | 30 | 90 | 150 |
| flex-end | 60 | 120 | 180 |
| space-between | 0 | 90 | 180 |
| space-around | 10 | 90 | 170 |
| space-evenly | 15 | 90 | 165 |

All six have `a.x === b.x === c.x === 0`.

- [ ] **Step 4: Fill in the column-reverse table**

| justifyContent | a.y | b.y | c.y |
| --- | --- | --- | --- |
| flex-start | 180 | 120 | 60 |
| center | 150 | 90 | 30 |
| flex-end | 120 | 60 | 0 |
| space-between | 180 | 90 | 0 |
| space-around | 170 | 90 | 10 |
| space-evenly | 165 | 90 | 15 |

- [ ] **Step 5: Generate the 24 cases from the tables**

Keep them explicit rather than looping, so `build.toString()` shows real code in the report. One helper per direction keeps it DRY without hiding the code:

```ts
type Expected = { a: number; b: number; c: number };

function rowCase(justify: Justify, exp: Expected, note: string): LayoutCase {
  return {
    id: `row-${justify}`,
    group: "Main axis",
    title: `flexDirection: "row", justifyContent: "${justify}"`,
    note,
    build: (root) => {
      root.setAttrs({ flexDirection: "row", justifyContent: justify });
      tiles(root);
    },
    expect: (p) => {
      expect(p.box(".a").x).toBeCloseTo(exp.a, 0);
      expect(p.box(".b").x).toBeCloseTo(exp.b, 0);
      expect(p.box(".c").x).toBeCloseTo(exp.c, 0);
      expect(p.box(".a").y).toBe(0);
    },
  };
}
```

`build.toString()` on a case made this way shows the arrow function including the captured `justify` name, which is honest and readable. Write the matching `rowReverseCase`, `columnCase`, and `columnReverseCase` (column variants assert `.y` and pin `.x` to 0). Import `Justify` from `../../src/index.js`.

Use `toBeCloseTo(value, 0)` throughout this group: `space-around`/`space-evenly` divide free space by 3 and 4, so a subpixel remainder is legitimate.

- [ ] **Step 6: Run and triage**

```bash
pnpm --filter @smoove/core run test:conformance
```

Expected: 24 Main axis tests, plus the id-uniqueness test. Any failure gets triaged, not renumbered. Pay attention to the reverse directions — nothing in the repo currently exercises them.

- [ ] **Step 7: Checkpoint**

```bash
pnpm --filter @smoove/core run test:conformance && pnpm --filter @smoove/core run test:conformance:types && pnpm check packages/core/conformance
```

---

## Task 3: Cross axis (13 cases)

**Files:**
- Create: `packages/core/conformance/cases/cross-axis.ts`
- Modify: `packages/core/conformance/corpus.ts`

- [ ] **Step 1: Write the `alignItems` cases (8)**

Row fixture: container 480x240, three tiles of differing heights — `.a` 100x40, `.b` 100x80, `.c` 100x120, `flexDirection: "row"`.

| alignItems | a.y | b.y | c.y |
| --- | --- | --- | --- |
| flex-start | 0 | 0 | 0 |
| center | 100 | 80 | 60 |
| flex-end | 200 | 160 | 120 |

`stretch` needs a separate fixture, because a child with an explicit height cannot stretch. Use three tiles with `width: 100` and **no** `height`: each must come out `height === 240`, `y === 0`.

Column fixture: container 480x240, `flexDirection: "column"`, tiles `.a` 40x60, `.b` 80x60, `.c` 120x60 — the cross axis is now x.

| alignItems | a.x | b.x | c.x |
| --- | --- | --- | --- |
| flex-start | 0 | 0 | 0 |
| center | 220 | 200 | 180 |
| flex-end | 440 | 400 | 360 |

`stretch` in a column: three tiles with `height: 60` and no `width`, each must come out `width === 480`, `x === 0`.

```ts
{
  id: "align-items-center-row",
  group: "Cross axis",
  title: 'alignItems: "center" (row)',
  note: "Children of different heights centre on the row's cross axis.",
  build: (root) => {
    root.setAttrs({ flexDirection: "row", alignItems: "center" });
    root.add(new Block({ name: "a", width: 100, height: 40, background: "#4ea1ff" }));
    root.add(new Block({ name: "b", width: 100, height: 80, background: "#7ee787" }));
    root.add(new Block({ name: "c", width: 100, height: 120, background: "#ff6b4e" }));
  },
  expect: (p) => {
    expect(p.box(".a").y).toBe(100);
    expect(p.box(".b").y).toBe(80);
    expect(p.box(".c").y).toBe(60);
  },
}
```

- [ ] **Step 2: Write the `alignSelf` cases (5)**

Fixture: container 480x240 row, `alignItems: "flex-start"`, three 100x60 tiles, with `.b` carrying the `alignSelf` under test.

| alignSelf on `.b` | b.y | b.height | a.y |
| --- | --- | --- | --- |
| auto | 0 | 60 | 0 |
| flex-start | 0 | 60 | 0 |
| center | 90 | 60 | 0 |
| flex-end | 180 | 60 | 0 |
| stretch | 0 | 240 | 0 |

`stretch` requires `.b` to have no explicit `height`, so that case builds `.b` as `new Block({ name: "b", width: 100, alignSelf: "stretch", background: "#7ee787" })`. Assert `a.y === 0` in every case to prove `alignSelf` is per-child, not container-wide.

- [ ] **Step 3: Register the group**

```ts
import { crossAxisCases } from "./cases/cross-axis.js";
// ...
export const corpus: LayoutCase[] = [...mainAxisCases, ...crossAxisCases];
```

- [ ] **Step 4: Run and triage**

```bash
pnpm --filter @smoove/core run test:conformance
```

- [ ] **Step 5: Checkpoint** — same three commands as Task 2 Step 7.

---

## Task 4: Sizing (8 cases)

**Files:**
- Create: `packages/core/conformance/cases/sizing.ts`
- Modify: `packages/core/conformance/corpus.ts`

- [ ] **Step 1: Write the eight cases**

| id | fixture | assertion |
| --- | --- | --- |
| `size-px` | row, one `Block({ width: 200, height: 80 })` | box is `200x80` at `(0,0)` |
| `size-percent` | row, one `Block({ width: "50%", height: "25%" })` | box is `240x60` (percent of the 480x240 content box) |
| `size-hug` | row, a `Block({ padding: 10 })` (no width/height) containing a `Block({ width: 100, height: 60 })` | outer box is `120x80`; inner sits at `(10,10)` |
| `size-grow-equal` | row, two `Block({ flexBasis: 0, flexGrow: 1 })` | each `240` wide, x = 0 and 240 |
| `size-grow-ratio` | row, `.a` `{ flexBasis: 0, flexGrow: 1 }`, `.b` `{ flexBasis: 0, flexGrow: 2 }` | a = 160, b = 320; b.x = 160 |
| `size-shrink-equal` | row, container `width: 300`, two `Block({ width: 200, flexShrink: 1 })` | overflow 100 splits evenly: each 150 |
| `size-shrink-zero` | row, container `width: 300`, `.a` `{ width: 200, flexShrink: 0 }`, `.b` `{ width: 200, flexShrink: 1 }` | a stays 200, b absorbs all 100 to become 100 |
| `size-basis` | row, one `Block({ width: 100, flexBasis: 250 })` | used main size is 250, not 100 |

The two shrink cases need a narrower root than the canvas. Give the case `size: [300, 240]` so the root Block is 300 wide, rather than nesting another container.

```ts
{
  id: "size-grow-ratio",
  group: "Sizing",
  title: "flexGrow distributes free space in proportion",
  note: "With flexBasis 0, a grow of 1 against 2 splits the 480px row one-third to two-thirds.",
  build: (root) => {
    root.setAttrs({ flexDirection: "row" });
    root.add(new Block({ name: "a", flexBasis: 0, flexGrow: 1, height: 80, background: "#4ea1ff" }));
    root.add(new Block({ name: "b", flexBasis: 0, flexGrow: 2, height: 80, background: "#7ee787" }));
  },
  expect: (p) => {
    expect(p.box(".a").width).toBeCloseTo(160, 0);
    expect(p.box(".b").width).toBeCloseTo(320, 0);
    expect(p.box(".b").x).toBeCloseTo(160, 0);
  },
}
```

- [ ] **Step 2: Register, run, triage, checkpoint** — as Task 3 Steps 3-5.

`size-hug` is the case most likely to expose a real bug: `readPixelSize` returns 0 for a hug root and `layoutRoot` only writes self-size when `alwaysSetSize` is true (which `Block` passes and `Flex` does not). A hug **`Flex`** would report a stale size; this case uses `Block`, so add a ninth case `size-hug-flex` using a `Flex` instead and record whatever it does as either a bug or a documented divergence.

---

## Task 5: Spacing (9 cases)

**Files:**
- Create: `packages/core/conformance/cases/spacing.ts`
- Modify: `packages/core/conformance/corpus.ts`

- [ ] **Step 1: Write the nine cases**

| id | fixture | assertion |
| --- | --- | --- |
| `gap-row` | row, three 100x60 tiles, `gap: 30` | x = 0, 130, 260 |
| `gap-column` | column, three 100x60 tiles, `gap: 30` | y = 0, 90, 180 |
| `padding-number` | row, `padding: 20`, one tile `width: "100%"`, `height: 60` | tile at `(20,20)`, width 440 |
| `padding-pair` | row, `padding: [10, 20]` (vertical, horizontal), one tile `width: "100%"`, `height: 60` | tile at `(20,10)`, width 440 |
| `padding-quad` | row, `padding: [5, 10, 15, 20]` (top, right, bottom, left), one tile `width: "100%"`, `height: "100%"` | tile at `(20,5)`, width 450, height 220 |
| `padding-object` | row, `padding: { top: 8, left: 12 }`, one 100x60 tile | tile at `(12,8)` |
| `margin-child` | row, `.a` `{ width: 100, height: 60, margin: 20 }`, `.b` 100x60 | a at x 20, b at x 140 |
| `margin-quad` | row, `.a` with `margin: [5, 10, 15, 20]`, `.b` 100x60 | a.x = 20, a.y = 5, b.x = 20 + 100 + 10 = 130 |
| `margin-centre` | row, `justifyContent: "center"`, `.a` `{ width: 100, height: 60, margin: 20 }` | outer width is 140, so a.x = (480 - 140) / 2 + 20 = 190 |

- [ ] **Step 2: Register, run, triage, checkpoint** — as Task 3 Steps 3-5.

---

## Task 6: Block paint (10 cases)

**Files:**
- Create: `packages/core/conformance/cases/block-paint.ts`
- Modify: `packages/core/conformance/corpus.ts`

This is the group where pixel probes carry the weight — geometry alone cannot tell a painted `Block` from an empty one.

- [ ] **Step 1: Write the ten cases**

Shared fixture unless stated: root is `justifyContent: "center", alignItems: "center"`, holding one `Block({ name: "card", width: 240, height: 120, ... })`. That puts the card at `(120, 60)` through `(360, 180)`, centre `(240, 120)`.

| id | config under test | pixel assertions |
| --- | --- | --- |
| `paint-solid` | `background: "#4ea1ff"` | centre `(240,120)` is `#4ea1ff`; page `(10,10)` is `PAGE_BG` |
| `paint-gradient-linear` | `background: { gradient: { type: "linear", stops: [[0,"#1f2937"],[1,"#7ee787"]], angle: 90 } }` | `(240,65)` differs from `(240,175)`; both differ from `PAGE_BG` |
| `paint-gradient-angle` | same stops, `angle: 0` | `(125,120)` differs from `(355,120)` — the axis rotated |
| `paint-gradient-radial` | `background: { gradient: { type: "radial", stops: [[0,"#7ee787"],[1,"#1f2937"]] } }` | centre `(240,120)` differs from `(125,65)` |
| `paint-border-uniform` | `background: "#101820"`, `borderSize: 6`, `borderColor: "#ff6b4e"` | `(240,63)` is `#ff6b4e`; centre is `#101820` |
| `paint-border-per-edge-colour` | `borderSize: 6`, `borderColor: ["#ff0000","#00ff00","#0000ff","#ffff00"]` (top,right,bottom,left) | top `(240,63)` red, right `(357,120)` green, bottom `(240,177)` blue, left `(123,120)` yellow |
| `paint-border-per-edge-size` | `borderColor: "#ff6b4e"`, `borderSize: [12, 0, 0, 0]` | `(240,65)` is border colour; `(240,120)` is not; right edge `(357,120)` is not |
| `paint-border-dashed` | `borderSize: 4`, `borderColor: "#ff6b4e"`, `borderStyle: "dashed"` | sample `x` from 130 to 350 step 5 at `y = 62`: at least one sample is the border colour and at least one is not |
| `paint-corner-radius` | `background: "#4ea1ff"`, `cornerRadius: 24` | `(123,63)` is `PAGE_BG` (cut away by the radius); `(240,120)` is `#4ea1ff`; `(240,63)` is `#4ea1ff` (mid-edge unaffected) |
| `paint-corner-radius-per-corner` | `cornerRadius: [24, 0, 0, 0]` | `(123,63)` is `PAGE_BG`; `(357,63)` is the card colour — only the top-left is cut |
| `paint-shadow` | `background: "#4ea1ff"`, `shadow: { color: "#000", blur: 16, offsetY: 8, opacity: 0.6 }` | `(240,190)` (just below the card) differs from `PAGE_BG`; `(10,10)` is still `PAGE_BG` |

That is 11 rows; keep all of them — the group budget was approximate.

```ts
{
  id: "paint-corner-radius",
  group: "Block paint",
  title: "cornerRadius rounds the background",
  note: "The corner pixel shows the page behind, while the mid-edge and centre stay painted.",
  build: (root) => {
    root.setAttrs({ flexDirection: "row", justifyContent: "center", alignItems: "center" });
    root.add(
      new Block({ name: "card", width: 240, height: 120, background: "#4ea1ff", cornerRadius: 24 }),
    );
  },
  expect: (p) => {
    p.expectColor(123, 63, PAGE_BG);
    p.expectColor(240, 63, "#4ea1ff");
    p.expectColor(240, 120, "#4ea1ff");
  },
}
```

Import `PAGE_BG` from `../harness.js`.

- [ ] **Step 2: Assert the probe points are where you think they are**

Before triaging any failure in this group as a bug, confirm the geometry: add `expect(p.box(".card")).toMatchObject({ x: 120, y: 60, width: 240, height: 120 })` to `paint-solid`. A wrong pixel coordinate looks exactly like a paint bug.

- [ ] **Step 3: Register, run, triage, checkpoint** — as Task 3 Steps 3-5.

---

## Task 7: Nesting and hug (6 cases)

**Files:**
- Create: `packages/core/conformance/cases/nesting.ts`
- Modify: `packages/core/conformance/corpus.ts`

- [ ] **Step 1: Write the six cases**

| id | fixture | assertion |
| --- | --- | --- |
| `nest-three-deep` | root row `padding: 20` > `.outer` Block `padding: 10` > `.inner` Block `padding: 5` > `.leaf` 60x40 | leaf at `(35,35)`; outer is `100x80`; inner is `80x60` |
| `nest-percent-in-hug` | root column > `.hug` Block (no width, `padding: 10`) containing `.child` `width: "50%"` `height: 40` | record what `%` resolves to against a hug parent; CSS resolves percent against the parent's resolved content width, which for a hug parent depends on the child — a circular case. Assert it is finite and non-zero, and document the resolved number in `note` |
| `nest-align-centre-hug` | root column > `.row` Block `{ flexDirection: "row", alignItems: "center", width: "100%" }` containing `.short` 50x20 and `.tall` 50x30 | short.y = 5, tall.y = 0 — the `fixNaNCross` case, mirroring `align-hug.test.ts` |
| `nest-grow-spacer` | root column > `.header` Block row `width: "100%"` containing `.left` 80x30, `.spacer` `{ flexGrow: 1 }`, `.right` 80x30 | left.x = 0, right.x = 400, both finite |
| `nest-hug-root-background` | root column > `.card` Block with `background: "#4ea1ff"`, `padding: 16`, no width/height, containing a 100x60 tile | card box is `132x92`; pixel at `(4,4)` is the card colour, proving the background sized to content rather than painting 0x0 |
| `nest-justify-in-hug-main` | root column > `.hug` Block `{ flexDirection: "row", justifyContent: "space-between" }` with no width, containing two 60x40 tiles | the open question from the spec: does `space-*` in a hug **main** axis produce NaN the way `center` did in a hug cross axis? Assert both x values are finite and the second is >= the first, then record the actual behaviour in `note` |

- [ ] **Step 2: Register, run, triage, checkpoint** — as Task 3 Steps 3-5.

If `nest-justify-in-hug-main` produces NaN, that is a genuine find: extend `fixNaNCross` to the main axis (same file, same shape of fix) and set `divergence` on the case naming flexily 0.7.1.

---

## Task 8: Text as a flex child (6 cases)

**Files:**
- Create: `packages/core/conformance/cases/text.ts`
- Modify: `packages/core/conformance/corpus.ts`

**Font caution.** These cases run against whatever face skia resolves for the default family, and glyph metrics differ across machines. Assert **structure** (line count, containment, monotonic relationships), never exact pixel widths. A case that asserts `width === 187.5` will pass on your machine and fail in CI.

- [ ] **Step 1: Write the six cases**

| id | fixture | assertion |
| --- | --- | --- |
| `text-wrap-to-available` | root column `padding: 20` > `Text({ name: "t", text: <~25 words>, fontSize: 18, fill: "#fff" })` | `box.width <= 440`; `measure(node).lines.length >= 3` |
| `text-hug-in-row` | root row > `Text({ name: "t", text: "Hello", fontSize: 24 })` and a 100x40 tile | text box width is > 0 and < 200 (it hugs, it does not fill the row); the tile starts at `t.width` |
| `text-column-parent` | root **column** > same short `Text` | the `parentIsColumn` branch of `setTextWrapperMeasure`: assert the box width is > 0 and `<= 480`, and that it renders on one line |
| `text-fit-in-box` | `Text({ name: "t", text: "Fit me", fitText: true, width: 300, height: 60 })` inside a row | `node.fontSize()` (the fitted size, per the Text rules) is > 0; box width `<= 300` |
| `text-max-lines` | `Text({ name: "t", text: <long>, fontSize: 18, maxLines: 2, ellipsis: true, width: 300 })` | `measure(node).lines.length === 2` |
| `text-beside-growing-sibling` | row: `Text` then `Block({ flexGrow: 1, height: 40 })` | text width + sibling width equals 480 within 1px; sibling x equals text width |

Use `Text` and `measure` from `../../src/index.js`. Reach the lines array via `p.node(".t")` then `measure(node).lines`.

- [ ] **Step 2: Register, run, triage, checkpoint** — as Task 3 Steps 3-5.

This is the group the spec flags as most likely to fail. `engine.ts:160` carries two undocumented flexily argument quirks and a `+1` fudge on measured width; if a case fails, read `setTextMeasure`/`setTextWrapperMeasure` before concluding anything.

---

## Task 9: Mixed leaves (6 cases)

**Files:**
- Create: `packages/core/conformance/cases/leaves.ts`
- Modify: `packages/core/conformance/corpus.ts`

- [ ] **Step 1: Add a synthetic image helper to `harness.ts`**

`Image` takes an injectable `loader`, so no file IO is needed.

```ts
import Konva from "konva";
import type { ImageLoader } from "../src/index.js";

/** A painted canvas standing in for a decoded bitmap — deterministic, no IO. */
export function syntheticImage(width: number, height: number): ImageLoader {
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#4ea1ff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ff6b4e";
  ctx.fillRect(0, 0, width / 2, height / 2);
  return () => Promise.resolve(canvas as unknown as HTMLImageElement);
}
```

Check the real `ImageLoader` signature in `packages/core/src/media/` (it is re-exported from the barrel alongside `setDefaultImageLoader`) and match it exactly — if it takes a `src` argument or returns something other than a promise of an image, adapt this helper rather than casting around it.

- [ ] **Step 2: Write the six cases**

| id | fixture | assertion |
| --- | --- | --- |
| `leaf-circle-origin` | row, `Circle({ name: "c", radius: 40, fill: "#4ea1ff" })` then a 100x60 tile | circle **box** is `80x80` at `x = 0` (origin-corrected via `getSelfRect`), and `circle.x() === 40`; the tile starts at x 80 |
| `leaf-star` | row, `Star({ name: "s", numPoints: 5, innerRadius: 20, outerRadius: 40 })` then a tile | star box width is `80` within 1px; tile x equals the star's box width |
| `leaf-image-intrinsic` | row, `Image({ name: "i", src: "synthetic", loader: syntheticImage(120, 80) })` | box is `120x80`; pixel at `(10,10)` is `#ff6b4e` (the helper's quadrant) |
| `leaf-image-object-fit` | `Image({ name: "i", width: 200, height: 80, objectFit: "cover", loader: syntheticImage(120, 80) })` | box is `200x80`; the image paints (pixel at centre is not `PAGE_BG`) |
| `leaf-raw-konva` | row, a bare `new Konva.Rect({ name: "r", width: 100, height: 50, fill: "#7ee787" })` (not the wrapper) then a tile | the raw-node fallback in `writeBack` places it at `x = 0`; tile at x 100 |
| `leaf-invisible-skipped` | row, three 100x60 tiles with `.b` set `visible(false)` | `c.x === 100`, not 200 — an invisible child takes no layout space (`display: none` semantics, `flex.ts:163`) |
| `leaf-radius-under-grow` | row, `Circle({ name: "c", radius: 40, flexGrow: 1 })` | the documented trap: `flexGrow` writes width/height onto a radius-derived shape. Assert the box is finite and non-zero, record the actual behaviour in `note`, and set `divergence` explaining that radius shapes should be given an explicit size |

- [ ] **Step 3: Register, run, triage, checkpoint** — as Task 3 Steps 3-5.

---

## Task 10: Animated reflow (5 cases)

**Files:**
- Create: `packages/core/conformance/cases/reflow.ts`
- Modify: `packages/core/conformance/corpus.ts`
- Modify: `packages/core/conformance/harness.ts`

This group proves the system's headline claim — layout recomputes every tick — and nothing in the repo currently tests it.

- [ ] **Step 1: Give cases access to the sequence**

Cases need `sequence.register()`. Widen `build` to receive it:

```ts
// types.ts
build: (root: Block, seq: Sequence) => void;
```

and in `harness.ts` call `c.build(root, seq)`. Update every existing case file: the extra parameter is optional at each call site since the existing cases just ignore it, but TypeScript requires the signature to match, so no edits are needed to existing cases (a function taking fewer parameters is assignable).

- [ ] **Step 2: Write the five cases**

Each asserts at frames `[0, 15, 30]`.

| id | updater | assertions |
| --- | --- | --- |
| `reflow-gap` | `seq.register((f) => root.setAttr("gap", f * 2))` on a row of three 100x60 tiles | frame 0: x = 0/100/200; frame 15: gap 30, x = 0/130/260; frame 30: gap 60, x = 0/160/320 |
| `reflow-grow` | two children `{ flexBasis: 0 }`, `.a` grow fixed 1, `.b` grow `1 + f / 15`; updater sets `.b`'s `flexGrow` | frame 0: 240/240; frame 15: a = 160, b = 320; frame 30: a = 120, b = 360 |
| `reflow-root-width` | `seq.register((f) => card.width(200 + f * 4))` on a hug-height `Block({ name: "card" })` holding a `width: "100%"` child | child width tracks the root: 200, 260, 320 |
| `reflow-visibility` | three tiles; `seq.register((f) => tileB.visible(f < 15))` | frame 0: c.x = 200; frame 15 and 30: c.x = 100 — the gap closes when the middle child disappears |
| `reflow-text` | a `Text` beside a `{ flexGrow: 1 }` block; `seq.register((f) => t.setText("x".repeat(4 + f)))` | the text box grows monotonically across the three frames and the sibling shrinks by the same amount within 1px |

`reflow-root-width` animates the **root** `Block`'s own width, which is legal (nothing places the root but you). Do not animate a child's `x`/`y`/`width`/`height` in any of these — the layout pass runs after updaters and would overwrite it. That constraint is itself worth a case: add `reflow-child-x-is-overwritten` asserting that setting `tileB.x(999)` inside an updater has no effect on the measured box, and set `divergence` documenting it as intended behaviour. That makes six cases in this group.

- [ ] **Step 3: Register, run, triage, checkpoint** — as Task 3 Steps 3-5.

---

## Task 11: Report generator

**Files:**
- Modify: `packages/core/conformance/report.ts`

- [ ] **Step 1: Write `writeReport`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { CaseResult } from "./types.js";

const OUT_DIR = fileURLToPath(new URL("./out/", import.meta.url));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function card(r: CaseResult): string {
  const geometry = Object.entries(r.geometry)
    .map(
      ([name, b]) =>
        `<tr><td>.${escapeHtml(name)}</td><td>${b.x.toFixed(1)}</td><td>${b.y.toFixed(1)}</td>` +
        `<td>${b.width.toFixed(1)}</td><td>${b.height.toFixed(1)}</td></tr>`,
    )
    .join("");
  const status = r.failures.length > 0 ? "fail" : "pass";
  const badges = [
    r.divergenceBadge,
    r.failures.length > 0 ? `<p class="failure">${escapeHtml(r.failures.join("; "))}</p>` : "",
  ].join("");
  return `
<article class="case ${status}" id="${escapeHtml(r.case.id)}">
  <h3>${escapeHtml(r.case.title)}</h3>
  <p class="note">${escapeHtml(r.case.note)}</p>
  ${badges}
  <img src="${r.png}" alt="${escapeHtml(r.case.title)}" width="${r.case.size?.[0] ?? 480}">
  <pre><code>${escapeHtml(r.source)}</code></pre>
  <table><thead><tr><th>node</th><th>x</th><th>y</th><th>w</th><th>h</th></tr></thead>
  <tbody>${geometry}</tbody></table>
</article>`;
}
```

`r.divergenceBadge` is not a field on `CaseResult` — build it inline instead:

```ts
const divergence = r.case.divergence
  ? `<p class="divergence">Diverges from CSS: ${escapeHtml(r.case.divergence)}</p>`
  : "";
```

and use `divergence` in place of `r.divergenceBadge`.

- [ ] **Step 2: Assemble the page**

```ts
export async function writeReport(results: CaseResult[]): Promise<void> {
  const groups = [...new Set(results.map((r) => r.case.group))];
  const passed = results.filter((r) => r.failures.length === 0).length;
  const sections = groups
    .map(
      (g) =>
        `<section><h2>${escapeHtml(g)}</h2><div class="grid">` +
        results
          .filter((r) => r.case.group === g)
          .map(card)
          .join("") +
        `</div></section>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>smoove layout conformance</title><style>${CSS}</style></head>
<body><h1>smoove layout conformance</h1>
<p class="summary">${passed} of ${results.length} cases pass.</p>
${sections}
${GAPS}
</body></html>`;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}report.html`, html, "utf8");
}
```

- [ ] **Step 3: Write the `GAPS` section**

```ts
const GAPS = `<section id="gaps"><h2>Not supported yet</h2>
<p>flexily, the engine underneath smoove's layout, implements all of these.
smoove does not expose them on <code>FlexProps</code>/<code>FlexChildProps</code>.
Each is a candidate for a future release.</p>
<ul>
<li><code>flexWrap</code> — multi-line flex containers</li>
<li><code>alignContent</code> — cross-axis distribution of wrapped lines</li>
<li><code>minWidth</code> / <code>maxWidth</code> / <code>minHeight</code> / <code>maxHeight</code></li>
<li><code>aspectRatio</code></li>
<li><code>position: absolute</code> with edge offsets</li>
<li>separate row and column gaps (flexily has <code>GUTTER_ROW</code> / <code>GUTTER_COLUMN</code>; smoove sets <code>GUTTER_ALL</code>)</li>
<li><code>auto</code> margins</li>
<li>percent <code>flexBasis</code></li>
<li>baseline alignment</li>
</ul></section>`;
```

- [ ] **Step 4: Write `CSS`**

A `const CSS = \`...\`` string. Requirements: cards in a responsive grid (`display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px`), images `max-width: 100%` on a checkerboard or neutral backing so transparency reads, `pre` with `overflow-x: auto`, a green left border on `.pass` and a red one on `.fail`, and both themes via `@media (prefers-color-scheme: dark)` plus `:root[data-theme="dark"]` / `:root[data-theme="light"]` overrides so the artifact's theme toggle wins.

- [ ] **Step 5: Run and open the report**

```bash
pnpm --filter @smoove/core run test:conformance
```

Expected: `packages/core/conformance/out/report.html` exists and contains one card per case.

```bash
open packages/core/conformance/out/report.html
```

- [ ] **Step 6: Checkpoint** — as Task 2 Step 7.

---

## Task 12: Triage pass

**Files:**
- Modify: whichever of `packages/core/src/layout/**` the failures point at
- Modify: the failing cases (to add `divergence` text only)

- [ ] **Step 1: List every failure**

```bash
pnpm --filter @smoove/core run test:conformance 2>&1 | tee /tmp/conformance.log
```

- [ ] **Step 2: Triage each one**

For each failure, decide: smoove bug, flexily bug, or deliberate divergence. Write the verdict into the case's `note` or `divergence`. Fix the smoove bugs. For flexily bugs, add a workaround in `packages/core/src/layout/flex/flex.ts` next to `fixNaNCross`, with a comment naming flexily 0.7.1 and what was verified.

- [ ] **Step 3: Confirm the existing suite still passes**

Any fix to `src/layout/` can move existing behaviour. Run everything:

```bash
pnpm --filter @smoove/core test
```

Expected: every pre-existing core test still passes, including `align-hug.test.ts`, `measure.test.ts`, `text-size.test.ts`, and `ink.test.ts`.

- [ ] **Step 4: Add a changeset if `src/` changed**

Only if a fix touched a published package:

```bash
pnpm changeset
```

Per the repo convention, a bug fix while pre-1.0 is a **patch**. A behaviour change that breaks a documented contract is a **minor**.

- [ ] **Step 5: Checkpoint**

```bash
pnpm --filter @smoove/core test && pnpm --filter @smoove/core run test:conformance:types && pnpm check packages/core
```

---

## Task 13: Publish the report

**Files:**
- Read: `packages/core/conformance/out/report.html`

- [ ] **Step 1: Regenerate against the final state**

```bash
pnpm --filter @smoove/core run test:conformance
```

- [ ] **Step 2: Publish as an artifact**

Publish `packages/core/conformance/out/report.html` with the Artifact tool: a favicon, a one-sentence description, and a title matching the page's `<title>`. Confirm the page is self-contained (no external requests — every PNG is a data URI and the CSS is inline).

- [ ] **Step 3: Report back**

Summarise: how many cases, how many passed first time, what was found and triaged into each bucket, and the gap list.

---

## Self-review notes

- Spec coverage: verification depth (Tasks 1, 6), conformance-not-change-detection (plan preamble, Task 12), the `LayoutCase` unit (Task 1), all nine coverage groups (Tasks 2-10), disk layout (Task 1), the report with gap list (Task 11), and every named risk (hug `Flex` in Task 4, hug main axis in Task 7, `Text` measure in Task 8, radius-under-grow in Task 9).
- Case count lands at ~85 rather than exactly 80: Task 4 gains `size-hug-flex`, Task 6 runs to 11, Task 9 to 7, Task 10 to 6. The spec said "roughly 80"; this is within it.
- `build`'s signature widens in Task 10. Existing cases need no edit — a function of one parameter is assignable to a two-parameter type — but `types.ts` must be updated before `harness.ts` calls `c.build(root, seq)`.
