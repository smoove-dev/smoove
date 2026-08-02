# @smoove/lottie Implementation Plan

> **For agentic workers:** implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rule that overrides the usual plan template: NEVER RUN `git commit`.** `AGENTS.md` forbids it and Rotem has confirmed it twice. Every task ends in a **Checkpoint** step (build + tests + lint) instead of a commit. Leave everything in the working tree.
>
> **Do not use subagents to execute this plan.** Rotem forbids subagent-driven execution; implement inline.

**Goal:** A `@smoove/lottie` package whose `Lottie` node plays After Effects / Lottie animations off the composition's frame clock and fps, identically in browser preview and headless mp4 render.

**Architecture:** `@lottiefiles/dotlottie-web` (ThorVG/WASM) renders into a DOM-free `RenderSurface` and hands back an RGBA `Uint8Array`. A pure `timing.ts` maps the composition's local frame onto a (possibly fractional) Lottie frame using core's existing `getMediaTime`. The node is a `FlexShape` leaf stamped with `TICK_MARK`, so `Sequence`/`Clip` drive it through the existing `_kmTick` contract — no changes to `@smoove/core`.

**Tech Stack:** TypeScript (`tsc -b`), Konva 10 (peer), `@smoove/core` (peer), `@lottiefiles/dotlottie-web` (dep), Vitest + `konva/skia-backend` for tests, Biome for lint/format.

**Spec:** [`docs/superpowers/specs/2026-07-27-lottie-package-design.md`](../specs/2026-07-27-lottie-package-design.md)

---

## Verified facts this plan depends on

These were proved by probe against `@lottiefiles/dotlottie-web@0.78.2` on Node 22.17. Do not re-litigate them; do re-verify if you bump the version.

- `canvas: { width, height }` (a bare `RenderSurface`) renders with **no DOM and no jsdom**.
- `setFrame(n)` is synchronous; `buffer` holds that frame immediately after. Re-seeking to the same frame gives byte-identical output.
- Fractional frames (`setFrame(20.5)`) genuinely interpolate.
- `buffer` is straight-alpha RGBA (pure red reads back `255,0,0,255`), length `width * height * 4`.
- Node's `fetch` **rejects `file://`** — the library silently falls back to unpkg. Ship the WASM as a `data:` URL instead. This is the single most important gotcha in the package.
- `@lottiefiles/dotlottie-web/dotlottie-player.wasm` is an exported subpath (`./dist/dotlottie-player.wasm` is **not**). Use the exported one.
- `animationSize()`, `markers()`, `segment`, `duration`, `totalFrames` are all available for intrinsic sizing and segment resolution.
- Cost in Node: 0.18 ms/frame @512², 0.77 ms @1080², 2.7 ms @1920×1080.

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/lottie/package.json` | package manifest |
| `packages/lottie/tsconfig.json` | `tsc -b` project, references `../core` |
| `packages/lottie/vitest.config.ts` | Vitest, node env, skia setup file |
| `packages/lottie/src/test/setup.ts` | installs `konva/skia-backend` for tests |
| `packages/lottie/src/types.ts` | `LottieConfig`, `LottieData` |
| `packages/lottie/src/timing.ts` | pure frame mapping — the heart of the package |
| `packages/lottie/src/engine.ts` | `LottieEngine` interface + DI seam |
| `packages/lottie/src/wasm.ts` | WASM URL resolution (browser CDN / Node `data:` URL) |
| `packages/lottie/src/dotlottie-engine.ts` | the dotlottie-web `LottieEngine` |
| `packages/lottie/src/surface.ts` | RGBA buffer → Konva canvas blit |
| `packages/lottie/src/lottie.ts` | the `Lottie` node |
| `packages/lottie/src/index.ts` | public barrel + default engine registration |
| `packages/lottie/src/fixtures/probe.json` | tiny hand-written Lottie used by engine tests |
| `packages/lottie/README.md` | package prose (write with the `smoove-writing` skill) |

---

## Task 1: Scaffold the package

**Files:**
- Create: `packages/lottie/package.json`
- Create: `packages/lottie/tsconfig.json`
- Create: `packages/lottie/vitest.config.ts`
- Create: `packages/lottie/src/test/setup.ts`
- Create: `packages/lottie/src/index.ts`
- Modify: `tsconfig.json` (root, add the project reference)
- Modify: `.changeset/config.json` (add to the `fixed` group)

- [ ] **Step 1: Write `packages/lottie/package.json`**

```json
{
  "name": "@smoove/lottie",
  "version": "0.3.5",
  "description": "Timeline-driven Lottie animations for smoove: a frame-pure Lottie node that plays on the composition clock.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/smoove-dev/smoove.git",
    "directory": "packages/lottie"
  },
  "homepage": "https://smoove.dev",
  "bugs": "https://github.com/smoove-dev/smoove/issues",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "clean": "rm -rf dist *.tsbuildinfo",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "pnpm build"
  },
  "peerDependencies": {
    "konva": ">=10"
  },
  "dependencies": {
    "@lottiefiles/dotlottie-web": "^0.78.2",
    "@smoove/core": "workspace:^"
  },
  "devDependencies": {
    "skia-canvas": "^3.0.8",
    "vitest": "^3.2.4"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

The version matches the other packages because the `fixed` changeset group versions everything in lockstep; `changeset version` will correct it if it drifts.

- [ ] **Step 2: Write `packages/lottie/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Write `packages/lottie/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 4: Write `packages/lottie/src/test/setup.ts`**

```ts
// Konva needs a canvas implementation in Node. The skia backend patches
// Konva.Util.createCanvasElement/createImageElement and installs
// DOMMatrix/Path2D globals — the same backend @smoove/renderer uses, so tests
// exercise the real server code path.
import "konva/skia-backend";
```

- [ ] **Step 5: Write a placeholder `packages/lottie/src/index.ts`**

```ts
export {};
```

It gets its real contents in Task 9. This exists so `tsc -b` has something to compile.

- [ ] **Step 6: Add the project reference to the root `tsconfig.json`**

Insert `{ "path": "./packages/lottie" }` into the `references` array, after the `./packages/code` entry:

```json
    { "path": "./packages/code" },
    { "path": "./packages/lottie" },
```

- [ ] **Step 7: Add the package to the `fixed` changeset group**

In `.changeset/config.json`, add `"@smoove/lottie"` to the single `fixed` array, after `"@smoove/code"`:

```json
  "fixed": [
    [
      "@smoove/code",
      "@smoove/lottie",
      "@smoove/core",
```

A new package under `packages/*` must be in `fixed` or `ignore` — see the Releases convention in `AGENTS.md`. It also needs a one-time trusted-publisher registration on npmjs.com; that is the maintainer's job, so flag it in the PR description rather than attempting it.

- [ ] **Step 8: Install**

```bash
pnpm install
```

Expected: `@smoove/lottie` appears in the workspace, `@lottiefiles/dotlottie-web` is downloaded.

- [ ] **Step 9: Checkpoint**

```bash
pnpm --filter @smoove/lottie build && pnpm check
```

Expected: build succeeds (empty output is fine), Biome reports no errors.

---

## Task 2: `types.ts` — the public config

**Files:**
- Create: `packages/lottie/src/types.ts`

- [ ] **Step 1: Write `packages/lottie/src/types.ts`**

```ts
import type {
  FlexChildProps,
  ObjectFit,
  ObjectPosition,
  SizeValue,
} from "@smoove/core";
import type Konva from "konva";
import type { LottieEngineFactory } from "./engine.js";

/** Animation payload accepted inline: parsed JSON, a JSON string, or `.lottie` bytes. */
export type LottieData = string | ArrayBuffer | Record<string, unknown>;

/**
 * Config for {@link Lottie}. Sizing, fit and trim props are spelled exactly as
 * `Image`/`Video` spell them; `speed`, `marker` and `segment` are the
 * Lottie-specific additions.
 */
export type LottieConfig = Omit<Konva.ShapeConfig, "width" | "height"> &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
    /** URL of a `.json` or `.lottie` animation. Mutually exclusive with {@link data}. */
    src?: string;
    /** Inline animation payload. Mutually exclusive with {@link src}. */
    data?: LottieData;
    /** How the animation scales into the node's box. Default `"contain"`. */
    objectFit?: ObjectFit;
    /** Where it sits when it doesn't fill the box. Default `"center"`. */
    objectPosition?: ObjectPosition;
    cornerRadius?: number | number[];
    /** Frames trimmed from the start of the animation (composition fps). */
    trimBefore?: number;
    /** Exclusive frame bound (composition fps). Defaults to the animation's own length. */
    trimAfter?: number;
    /** Repeat within the sequence window instead of freezing on the last frame. */
    loop?: boolean;
    /** Playback rate against composition time. Default `1`. */
    speed?: number;
    /** Play only this named Lottie marker's range. */
    marker?: string;
    /** Explicit Lottie-frame range `[start, end)`. Overrides {@link marker}. */
    segment?: [number, number];
    /**
     * Rasterization scale. Defaults to the stage's pixel ratio, clamped to 3.
     * Lower it to trade sharpness for speed on large animations.
     */
    pixelRatio?: number;
    /** Inject an alternative engine. Defaults to the dotlottie-web engine. */
    engineFactory?: LottieEngineFactory;
  };
```

- [ ] **Step 2: Checkpoint**

This file will not typecheck until Task 4 creates `engine.ts`. That is expected — do not create a stub `engine.ts` here, just move on to Task 3.

---

## Task 3: `timing.ts` — frame mapping (TDD)

This is the package's actual logic and the only part with interesting edge cases, so it is pure, engine-free, and fully tested.

**Files:**
- Create: `packages/lottie/src/timing.ts`
- Test: `packages/lottie/src/timing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/lottie/src/timing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lottieFrameAt, naturalDurationInFrames, resolveSegment } from "./timing.js";

/** A 24 fps, 48-frame (2 s) animation inside a 30 fps composition. */
const base = {
  fps: 30,
  lottieFps: 24,
  totalFrames: 48,
  trimBefore: 0,
  loop: false,
  speed: 1,
} as const;

describe("naturalDurationInFrames", () => {
  it("converts the animation's length into composition frames", () => {
    // 48 lottie frames / 24 fps = 2 s; 2 s * 30 fps = 60 composition frames.
    expect(naturalDurationInFrames(base)).toBe(60);
  });

  it("returns 0 when either frame rate is unknown", () => {
    expect(naturalDurationInFrames({ ...base, lottieFps: 0 })).toBe(0);
    expect(naturalDurationInFrames({ ...base, fps: 0 })).toBe(0);
  });
});

describe("resolveSegment", () => {
  it("defaults to the whole animation", () => {
    expect(resolveSegment(base)).toEqual([0, 48]);
  });

  it("clamps an explicit segment into range and keeps start <= end", () => {
    expect(resolveSegment({ ...base, segment: [-5, 100] })).toEqual([0, 48]);
    expect(resolveSegment({ ...base, segment: [30, 10] })).toEqual([30, 30]);
  });
});

describe("lottieFrameAt", () => {
  it("resamples the animation's fps onto the composition's clock", () => {
    // Composition frame 15 = 0.5 s = lottie frame 12.
    expect(lottieFrameAt(15, base)).toBeCloseTo(12, 6);
  });

  it("produces fractional frames when the rates do not divide evenly", () => {
    // Composition frame 1 = 1/30 s = lottie frame 0.8.
    expect(lottieFrameAt(1, base)).toBeCloseTo(0.8, 6);
  });

  it("starts at the first frame", () => {
    expect(lottieFrameAt(0, base)).toBeCloseTo(0, 6);
  });

  it("freezes on the last frame past the end when not looping", () => {
    // Well past the 60-composition-frame length.
    expect(lottieFrameAt(200, base)).toBeCloseTo(47, 6);
  });

  it("wraps at the animation's natural length when looping", () => {
    // 60 composition frames per loop; frame 75 is 15 frames in = lottie 12.
    expect(lottieFrameAt(75, { ...base, loop: true })).toBeCloseTo(12, 6);
  });

  it("applies speed", () => {
    // Double speed: composition frame 15 covers 1 s = lottie frame 24.
    expect(lottieFrameAt(15, { ...base, speed: 2 })).toBeCloseTo(24, 6);
  });

  it("offsets by trimBefore, in composition frames", () => {
    // trimBefore 15 composition frames = 0.5 s = lottie frame 12 at local 0.
    expect(lottieFrameAt(0, { ...base, trimBefore: 15 })).toBeCloseTo(12, 6);
  });

  it("honours trimAfter as an exclusive composition-frame bound", () => {
    const t = { ...base, trimAfter: 30 };
    // Freezes at the last frame inside the 30-frame window: lottie frame 23.2.
    expect(lottieFrameAt(100, t)).toBeCloseTo(23.2, 6);
  });

  it("plays inside an explicit segment and stays there", () => {
    const t = { ...base, segment: [24, 48] as [number, number] };
    expect(lottieFrameAt(0, t)).toBeCloseTo(24, 6);
    expect(lottieFrameAt(15, t)).toBeCloseTo(36, 6);
    expect(lottieFrameAt(500, t)).toBeCloseTo(47, 6);
  });

  it("loops inside an explicit segment", () => {
    // A 24-frame segment at 24 fps = 1 s = 30 composition frames per loop.
    const t = { ...base, segment: [24, 48] as [number, number], loop: true };
    expect(lottieFrameAt(45, t)).toBeCloseTo(36, 6);
  });

  it("returns the segment start when the composition fps is unknown", () => {
    expect(lottieFrameAt(10, { ...base, fps: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @smoove/lottie test
```

Expected: FAIL — `Failed to resolve import "./timing.js"`.

- [ ] **Step 3: Write `packages/lottie/src/timing.ts`**

```ts
import { getMediaTime } from "@smoove/core";

/**
 * Everything needed to place a composition frame onto a Lottie animation.
 * Frame counts in `trimBefore`/`trimAfter` are **composition** frames (as in
 * `Video`); `segment` and the return value are **Lottie** frames.
 */
export type LottieTiming = {
  /** The composition's frame rate — the clock `localFrame` is expressed in. */
  fps: number;
  /** The animation's own frame rate. */
  lottieFps: number;
  /** The animation's total frame count. */
  totalFrames: number;
  /** Composition frames trimmed off the start. */
  trimBefore: number;
  /** Exclusive composition-frame bound. Defaults to the playable length. */
  trimAfter?: number;
  /** Wrap instead of freezing on the last frame. */
  loop: boolean;
  /** Playback rate against composition time. */
  speed: number;
  /** Lottie-frame range `[start, end)` to play. Defaults to the whole animation. */
  segment?: readonly [number, number];
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** The animation's playable length expressed in composition frames. */
export function naturalDurationInFrames(timing: LottieTiming): number {
  const { fps, lottieFps } = timing;
  if (fps <= 0 || lottieFps <= 0) return 0;
  const [start, end] = resolveSegment(timing);
  return Math.max(1, Math.round(((end - start) / lottieFps) * fps));
}

/** The playable Lottie-frame range, clamped into the animation and ordered. */
export function resolveSegment(timing: LottieTiming): [number, number] {
  const total = Math.max(0, timing.totalFrames);
  const [rawStart, rawEnd] = timing.segment ?? [0, total];
  const start = clamp(rawStart, 0, total);
  const end = clamp(rawEnd, start, total);
  return [start, end];
}

/**
 * Map a timeline-local composition frame onto a (possibly fractional) Lottie
 * frame. Delegates trims and loop wrap-around to core's `getMediaTime`, the
 * same helper `Video` and `Audio` use, so all three behave identically.
 */
export function lottieFrameAt(localFrame: number, timing: LottieTiming): number {
  const [start, end] = resolveSegment(timing);
  if (timing.fps <= 0 || timing.lottieFps <= 0) return start;

  const seconds = getMediaTime(localFrame, {
    fps: timing.fps,
    trimBefore: timing.trimBefore,
    trimAfter: timing.trimAfter ?? timing.trimBefore + naturalDurationInFrames(timing),
    loop: timing.loop,
    playbackRate: timing.speed,
  });

  // `seconds` counts from the animation's start, so the segment offset is added
  // on top. The last renderable frame is `end - 1`.
  return clamp(start + seconds * timing.lottieFps, start, Math.max(start, end - 1));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @smoove/lottie test
```

Expected: PASS, 14 tests.

If `getMediaTime`'s `MediaTiming` type does not accept this object shape, read `packages/core/src/media/media-time.ts` and match its fields exactly rather than casting.

- [ ] **Step 5: Checkpoint**

```bash
pnpm --filter @smoove/lottie test && pnpm check
```

---

## Task 4: `engine.ts` — the engine interface and DI seam

**Files:**
- Create: `packages/lottie/src/engine.ts`

- [ ] **Step 1: Write `packages/lottie/src/engine.ts`**

```ts
import type { ObjectFit } from "@smoove/core";
import type { LottieData } from "./types.js";

/** What {@link LottieEngineFactory} is handed when a node needs a renderer. */
export type LottieEngineOptions = {
  /** Render surface size in device pixels. */
  width: number;
  height: number;
  src?: string;
  data?: LottieData;
  /** How the animation scales into the surface. */
  fit: ObjectFit;
  /** Alignment in 0..1 surface coordinates — `[0.5, 0.5]` is centered. */
  align: [number, number];
  /** Named marker to use as the playback range. */
  marker?: string;
};

/**
 * A frame-pure Lottie rasterizer. `setFrame` must be synchronous and
 * deterministic: the same frame must always produce the same `buffer`.
 *
 * The seam lives in this package rather than in `@smoove/core` because — unlike
 * media, where the renderer swaps browser decoding for Node decoding — the
 * default engine is already environment-agnostic. `@smoove/renderer` needs no
 * knowledge of Lottie at all. This interface exists so engines are stubbable in
 * tests and replaceable later.
 */
export interface LottieEngine {
  /** Resolves once the WASM and the animation are loaded. Rejects on load failure. */
  readonly ready: Promise<void>;
  /** The animation's own frame rate. `0` before {@link ready} resolves. */
  readonly fps: number;
  /** The animation's total frame count. `0` before {@link ready} resolves. */
  readonly totalFrames: number;
  /** The animation's length in seconds. `0` before {@link ready} resolves. */
  readonly duration: number;
  /** The animation's authored size, or `null` if unknown. */
  readonly intrinsicSize: { width: number; height: number } | null;
  /** The effective Lottie-frame range `[start, end)`, honouring `marker`. */
  readonly segment: [number, number];
  /** Render a (possibly fractional) Lottie frame. Synchronous. */
  setFrame(frame: number): void;
  /** RGBA pixels for the last rendered frame, or `null` before the first render. */
  readonly buffer: Uint8Array | null;
  /** Resize the render surface. No-op when the size is unchanged. */
  resize(width: number, height: number): void;
  destroy(): void;
}

export type LottieEngineFactory = (options: LottieEngineOptions) => LottieEngine;

let defaultFactory: LottieEngineFactory | null = null;

/** Register the engine `Lottie` nodes use when none is injected per node. */
export function setDefaultLottieEngineFactory(factory: LottieEngineFactory): void {
  defaultFactory = factory;
}

export function getDefaultLottieEngineFactory(): LottieEngineFactory {
  if (!defaultFactory) {
    throw new Error(
      "[smoove] No Lottie engine registered. Import @smoove/lottie (not a deep path) so the default engine registers itself.",
    );
  }
  return defaultFactory;
}
```

- [ ] **Step 2: Checkpoint**

```bash
pnpm --filter @smoove/lottie build && pnpm check
```

Expected: `types.ts` and `engine.ts` now typecheck against each other.

---

## Task 5: `wasm.ts` — WASM URL resolution

The one place where browser and Node genuinely differ.

**Files:**
- Create: `packages/lottie/src/wasm.ts`

- [ ] **Step 1: Write `packages/lottie/src/wasm.ts`**

```ts
import { DotLottie } from "@lottiefiles/dotlottie-web";

let configuredUrl: string | null = null;
let applied: Promise<void> | null = null;

/**
 * Point the Lottie engine at a specific `dotlottie-player.wasm`.
 *
 * The browser default is the library's own CDN, which needs no setup. To
 * self-host, import the wasm through your bundler and hand over the URL:
 *
 * ```ts
 * import wasmUrl from "@lottiefiles/dotlottie-web/dotlottie-player.wasm?url";
 * setLottieWasmUrl(wasmUrl);
 * ```
 *
 * Call before constructing any `Lottie` node — the WASM instance is shared
 * process-wide and resolved once.
 */
export function setLottieWasmUrl(url: string): void {
  configuredUrl = url;
  applied = null;
}

/**
 * Resolve the wasm in Node as a `data:` URL.
 *
 * Node's `fetch` rejects `file://`, and dotlottie-web reacts by silently
 * falling back to unpkg — which turns every headless render into a network
 * call, and breaks entirely offline. Inlining the bytes avoids both.
 *
 * The `node:`-prefixed dynamic imports matter: a bare `"module"` specifier is
 * what broke effects in server renders before (see the guard in
 * `packages/renderer/src/gl-node.ts`), and bundlers must not follow these.
 */
async function nodeWasmDataUrl(): Promise<string | null> {
  try {
    const { createRequire } = await import("node:module");
    const { readFile } = await import("node:fs/promises");
    const require = createRequire(import.meta.url);
    const path = require.resolve("@lottiefiles/dotlottie-web/dotlottie-player.wasm");
    const bytes = await readFile(path);
    return `data:application/wasm;base64,${bytes.toString("base64")}`;
  } catch (err) {
    console.warn(
      "[smoove] Could not inline the Lottie wasm; falling back to the CDN.",
      err,
    );
    return null;
  }
}

function isNodeLike(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions?.node !== undefined &&
    typeof window === "undefined"
  );
}

/**
 * Apply the WASM URL exactly once per process. Safe to await from every node;
 * concurrent callers share the same promise.
 */
export function ensureLottieWasm(): Promise<void> {
  if (applied) return applied;
  applied = (async () => {
    if (configuredUrl) {
      DotLottie.setWasmUrl(configuredUrl);
      return;
    }
    if (!isNodeLike()) return; // Browser: the library's CDN default is fine.
    const url = await nodeWasmDataUrl();
    if (url) DotLottie.setWasmUrl(url);
  })();
  return applied;
}
```

- [ ] **Step 2: Checkpoint**

```bash
pnpm --filter @smoove/lottie build && pnpm check
```

---

## Task 6: `dotlottie-engine.ts` — the real engine (TDD against a fixture)

**Files:**
- Create: `packages/lottie/src/fixtures/probe.json`
- Create: `packages/lottie/src/dotlottie-engine.ts`
- Test: `packages/lottie/src/dotlottie-engine.test.ts`

- [ ] **Step 1: Write the fixture animation**

Create `packages/lottie/src/fixtures/probe.json`. A 200×200, 24 fps, 48-frame animation with a red square sliding left to right — small enough to read, real enough to prove the rasterizer works:

```json
{
  "v": "5.7.4",
  "fr": 24,
  "ip": 0,
  "op": 48,
  "w": 200,
  "h": 200,
  "nm": "probe",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "rect",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "r": { "a": 0, "k": 0 },
        "p": {
          "a": 1,
          "k": [
            {
              "t": 0,
              "s": [20, 100, 0],
              "e": [180, 100, 0],
              "i": { "x": [1], "y": [1] },
              "o": { "x": [0], "y": [0] }
            },
            { "t": 47, "s": [180, 100, 0] }
          ]
        },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 0, "k": [100, 100, 100] }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ty": "rc",
              "d": 1,
              "s": { "a": 0, "k": [40, 40] },
              "p": { "a": 0, "k": [0, 0] },
              "r": { "a": 0, "k": 0 }
            },
            {
              "ty": "fl",
              "c": { "a": 0, "k": [1, 0, 0, 1] },
              "o": { "a": 0, "k": 100 },
              "r": 1
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ]
        }
      ],
      "ip": 0,
      "op": 48,
      "st": 0
    }
  ]
}
```

Add `"resolveJsonModule": true` to `packages/lottie/tsconfig.json`'s `compilerOptions` only if the test imports it as a module; the test below reads it with `node:fs` instead, so no tsconfig change is needed.

- [ ] **Step 2: Write the failing tests**

Create `packages/lottie/src/dotlottie-engine.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDotLottieEngine } from "./dotlottie-engine.js";

const probe = JSON.parse(
  readFileSync(new URL("./fixtures/probe.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

function engine(width = 128, height = 128) {
  return createDotLottieEngine({
    width,
    height,
    data: probe,
    fit: "contain",
    align: [0.5, 0.5],
  });
}

/** Alpha coverage of the middle scanline, plus the leftmost covered column. */
function scanMidRow(buffer: Uint8Array, width: number, height: number) {
  const row = Math.floor(height / 2);
  let covered = 0;
  let firstX = -1;
  for (let x = 0; x < width; x++) {
    if (buffer[(row * width + x) * 4 + 3] > 10) {
      covered++;
      if (firstX < 0) firstX = x;
    }
  }
  return { covered, firstX };
}

describe("dotlottie engine", () => {
  it("loads headlessly and reports the animation's own timing", async () => {
    const e = engine();
    await e.ready;
    expect(e.fps).toBeCloseTo(24, 3);
    expect(e.totalFrames).toBe(48);
    expect(e.duration).toBeCloseTo(2, 2);
    expect(e.intrinsicSize).toEqual({ width: 200, height: 200 });
    expect(e.segment).toEqual([0, 48]);
    e.destroy();
  });

  it("renders an RGBA buffer of exactly the surface size", async () => {
    const e = engine(64, 64);
    await e.ready;
    e.setFrame(0);
    expect(e.buffer?.length).toBe(64 * 64 * 4);
    e.destroy();
  });

  it("moves the square as the frame advances", async () => {
    const e = engine();
    await e.ready;
    e.setFrame(0);
    const start = scanMidRow(e.buffer as Uint8Array, 128, 128);
    e.setFrame(47);
    const end = scanMidRow(e.buffer as Uint8Array, 128, 128);
    expect(start.covered).toBeGreaterThan(0);
    expect(end.firstX).toBeGreaterThan(start.firstX);
    e.destroy();
  });

  it("is deterministic on re-seek", async () => {
    const e = engine();
    await e.ready;
    e.setFrame(12);
    const first = Uint8Array.from(e.buffer as Uint8Array);
    e.setFrame(40);
    e.setFrame(12);
    const second = Uint8Array.from(e.buffer as Uint8Array);
    expect(second).toEqual(first);
    e.destroy();
  });

  it("interpolates fractional frames", async () => {
    const e = engine();
    await e.ready;
    e.setFrame(12);
    const whole = Uint8Array.from(e.buffer as Uint8Array);
    e.setFrame(12.5);
    const half = Uint8Array.from(e.buffer as Uint8Array);
    expect(half).not.toEqual(whole);
    e.destroy();
  });

  it("reallocates the surface on resize", async () => {
    const e = engine(64, 64);
    await e.ready;
    e.setFrame(0);
    expect(e.buffer?.length).toBe(64 * 64 * 4);
    e.resize(96, 48);
    e.setFrame(0);
    expect(e.buffer?.length).toBe(96 * 48 * 4);
    e.destroy();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
pnpm --filter @smoove/lottie test dotlottie-engine
```

Expected: FAIL — `Failed to resolve import "./dotlottie-engine.js"`.

- [ ] **Step 4: Write `packages/lottie/src/dotlottie-engine.ts`**

```ts
import { DotLottie } from "@lottiefiles/dotlottie-web";
import type { LottieEngine, LottieEngineOptions } from "./engine.js";
import { ensureLottieWasm } from "./wasm.js";

/** Our `ObjectFit` vocabulary is a subset of dotlottie's `Fit`, so it passes straight through. */
function toFit(fit: LottieEngineOptions["fit"]): "contain" | "cover" | "fill" | "none" {
  return fit;
}

/**
 * A {@link LottieEngine} backed by dotlottie-web (ThorVG/WASM). Renders into a
 * bare `RenderSurface` — no canvas, no DOM — so the browser and the headless
 * renderer run byte-identical rasterization.
 */
class DotLottieEngine implements LottieEngine {
  readonly ready: Promise<void>;

  private _player: DotLottie | null = null;
  private _width: number;
  private _height: number;
  private _lastFrame: number | null = null;

  constructor(options: LottieEngineOptions) {
    this._width = Math.max(1, Math.round(options.width));
    this._height = Math.max(1, Math.round(options.height));
    this.ready = this._load(options);
  }

  private async _load(options: LottieEngineOptions): Promise<void> {
    await ensureLottieWasm();
    const player = new DotLottie({
      canvas: { width: this._width, height: this._height },
      src: options.src,
      data: options.data,
      marker: options.marker,
      autoplay: false,
      loop: false,
      useFrameInterpolation: true,
      layout: { fit: toFit(options.fit), align: options.align },
    });
    this._player = player;
    await new Promise<void>((resolve, reject) => {
      player.addEventListener("load", () => resolve());
      player.addEventListener("loadError", (event) =>
        reject(event.error ?? new Error("[smoove] Lottie failed to load")),
      );
    });
  }

  get fps(): number {
    const p = this._player;
    if (!p || p.duration <= 0) return 0;
    return p.totalFrames / p.duration;
  }

  get totalFrames(): number {
    return this._player?.totalFrames ?? 0;
  }

  get duration(): number {
    return this._player?.duration ?? 0;
  }

  get intrinsicSize(): { width: number; height: number } | null {
    const size = this._player?.animationSize();
    if (!size || size.width <= 0 || size.height <= 0) return null;
    return { width: size.width, height: size.height };
  }

  get segment(): [number, number] {
    const p = this._player;
    if (!p) return [0, 0];
    // dotlottie reports an inclusive [start, end] frame pair; we use a
    // half-open range everywhere else, so widen the end by one.
    const seg = p.segment;
    if (!seg) return [0, p.totalFrames];
    return [seg[0], seg[1] + 1];
  }

  setFrame(frame: number): void {
    const p = this._player;
    if (!p) return;
    if (this._lastFrame === frame) return;
    this._lastFrame = frame;
    p.setFrame(frame);
  }

  get buffer(): Uint8Array | null {
    return this._player?.buffer ?? null;
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this._width && h === this._height) return;
    this._width = w;
    this._height = h;
    this._lastFrame = null; // Force a re-render into the new surface.
    this._player?.setCanvas({ width: w, height: h });
  }

  destroy(): void {
    this._player?.destroy();
    this._player = null;
  }
}

export function createDotLottieEngine(options: LottieEngineOptions): LottieEngine {
  return new DotLottieEngine(options);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter @smoove/lottie test dotlottie-engine
```

Expected: PASS, 6 tests.

Two things to check if they do not:
- If `segment` is already half-open, drop the `+ 1` and fix the `[0, 48]` assertion accordingly. Read the value the library actually returns before changing the test.
- If `setCanvas` does not reallocate the pixel buffer, replace `resize` with a destroy-and-reload of the player at the new size, keeping the same public behaviour.

- [ ] **Step 6: Checkpoint**

```bash
pnpm --filter @smoove/lottie test && pnpm --filter @smoove/lottie build && pnpm check
```

---

## Task 7: `surface.ts` — RGBA → canvas blit (TDD)

**Files:**
- Create: `packages/lottie/src/surface.ts`
- Test: `packages/lottie/src/surface.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/lottie/src/surface.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blit, createSurface, resizeSurface } from "./surface.js";

/** A solid-colour RGBA buffer. */
function fill(width: number, height: number, rgba: [number, number, number, number]) {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) out.set(rgba, i * 4);
  return out;
}

function pixelAt(surface: ReturnType<typeof createSurface>, x: number, y: number) {
  const ctx = surface.canvas.getContext("2d") as CanvasRenderingContext2D;
  return Array.from(ctx.getImageData(x, y, 1, 1).data);
}

describe("surface", () => {
  it("creates a canvas at the requested size", () => {
    const s = createSurface(32, 16);
    expect(s.width).toBe(32);
    expect(s.height).toBe(16);
    expect(s.canvas.width).toBe(32);
    expect(s.canvas.height).toBe(16);
  });

  it("writes RGBA pixels through to the canvas", () => {
    const s = createSurface(8, 8);
    blit(s, fill(8, 8, [255, 0, 0, 255]));
    expect(pixelAt(s, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it("ignores a buffer smaller than the surface rather than tearing", () => {
    const s = createSurface(8, 8);
    blit(s, fill(8, 8, [0, 255, 0, 255]));
    blit(s, new Uint8Array(4));
    expect(pixelAt(s, 4, 4)).toEqual([0, 255, 0, 255]);
  });

  it("reallocates on resize and reports the new size", () => {
    const s = createSurface(8, 8);
    const resized = resizeSurface(s, 16, 4);
    expect(resized.width).toBe(16);
    expect(resized.height).toBe(4);
    expect(resized.canvas.width).toBe(16);
    expect(resized.canvas.height).toBe(4);
  });

  it("returns the same surface when the size is unchanged", () => {
    const s = createSurface(8, 8);
    expect(resizeSurface(s, 8, 8)).toBe(s);
  });

  it("leaves no stale pixels after a resize", () => {
    const s = createSurface(8, 8);
    blit(s, fill(8, 8, [255, 0, 0, 255]));
    const bigger = resizeSurface(s, 16, 16);
    expect(pixelAt(bigger, 12, 12)).toEqual([0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @smoove/lottie test surface
```

Expected: FAIL — `Failed to resolve import "./surface.js"`.

- [ ] **Step 3: Write `packages/lottie/src/surface.ts`**

```ts
import Konva from "konva";

/**
 * An offscreen canvas plus the `ImageData` scratch used to push RGBA pixels
 * into it. The canvas comes from `Konva.Util.createCanvasElement()`, which the
 * skia backend patches under `@smoove/renderer` — so this file has no
 * environment branch of its own.
 */
export type LottieSurface = {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  /** Reused every frame; allocating one per frame would churn 8 MB/s at 1080p. */
  readonly scratch: ImageData | null;
};

export function createSurface(width: number, height: number): LottieSurface {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return {
    canvas,
    width: w,
    height: h,
    scratch: ctx ? ctx.createImageData(w, h) : null,
  };
}

/** Return a surface of the requested size, reusing `surface` when it already matches. */
export function resizeSurface(
  surface: LottieSurface,
  width: number,
  height: number,
): LottieSurface {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (surface.width === w && surface.height === h) return surface;
  return createSurface(w, h);
}

/**
 * Copy an engine's RGBA buffer into the surface. The engine's buffer lives in
 * WASM memory and can be detached on resize, so it is always copied, never
 * retained. A short buffer is ignored rather than partially applied — a torn
 * frame is worse than a stale one.
 */
export function blit(surface: LottieSurface, rgba: Uint8Array | null): void {
  const { scratch } = surface;
  if (!rgba || !scratch) return;
  const expected = surface.width * surface.height * 4;
  if (rgba.length < expected) return;
  scratch.data.set(rgba.subarray(0, expected));
  const ctx = surface.canvas.getContext("2d");
  ctx?.putImageData(scratch, 0, 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @smoove/lottie test surface
```

Expected: PASS, 6 tests.

If `Konva.Util.createCanvasElement` is not typed as returning an `HTMLCanvasElement`, read its signature in `node_modules/konva/lib/Util.d.ts` and match it — do not cast to `any`.

- [ ] **Step 5: Checkpoint**

```bash
pnpm --filter @smoove/lottie test && pnpm check
```

---

## Task 8: `lottie.ts` — the node (TDD with a stub engine)

**Files:**
- Create: `packages/lottie/src/lottie.ts`
- Test: `packages/lottie/src/lottie.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/lottie/src/lottie.test.ts`. The engine is stubbed through the config's `engineFactory` seam, so this tests the node's wiring — not the rasterizer, which Task 6 already covers.

```ts
import { Composition, Sequence } from "@smoove/core";
import { describe, expect, it } from "vitest";
import type { LottieEngine, LottieEngineOptions } from "./engine.js";
import { Lottie } from "./lottie.js";

/** A 24 fps, 48-frame, 200x200 animation that records every frame it is asked for. */
function stubEngine(): { engine: LottieEngine; options: LottieEngineOptions[]; frames: number[] } {
  const frames: number[] = [];
  const options: LottieEngineOptions[] = [];
  let width = 1;
  let height = 1;
  const engine: LottieEngine = {
    ready: Promise.resolve(),
    fps: 24,
    totalFrames: 48,
    duration: 2,
    intrinsicSize: { width: 200, height: 200 },
    segment: [0, 48],
    setFrame: (frame) => frames.push(frame),
    get buffer() {
      return new Uint8Array(width * height * 4);
    },
    resize: (w, h) => {
      width = w;
      height = h;
    },
    destroy: () => {},
  };
  return {
    engine,
    options,
    frames,
  };
}

let counter = 0;
function makeComp(): Composition {
  counter += 1;
  return new Composition({
    id: `lottie-t${counter}`,
    fps: 30,
    durationInFrames: 300,
    width: 640,
    height: 360,
  });
}

function mount(config: Record<string, unknown> = {}) {
  const stub = stubEngine();
  const comp = makeComp();
  const seq = new Sequence({ from: 0, durationInFrames: 300 });
  const node = new Lottie({
    data: { fake: true },
    width: 100,
    height: 100,
    engineFactory: (options) => {
      stub.options.push(options);
      return stub.engine;
    },
    ...config,
  });
  seq.add(node);
  comp.add(seq);
  return { comp, seq, node, stub };
}

describe("Lottie node", () => {
  it("maps composition frames onto the animation's own frame rate", async () => {
    const { comp, node, stub } = mount();
    await node.ready;
    comp.setFrame(0);
    comp.setFrame(15);
    // 30 fps composition, 24 fps animation: frame 15 is 0.5 s in = lottie 12.
    expect(stub.frames.at(-1)).toBeCloseTo(12, 6);
  });

  it("freezes on the last frame past the end", async () => {
    const { comp, node, stub } = mount();
    await node.ready;
    comp.setFrame(250);
    expect(stub.frames.at(-1)).toBeCloseTo(47, 6);
  });

  it("wraps when looping", async () => {
    const { comp, node, stub } = mount({ loop: true });
    await node.ready;
    // The animation is 2 s = 60 composition frames; frame 75 is 15 frames in.
    comp.setFrame(75);
    expect(stub.frames.at(-1)).toBeCloseTo(12, 6);
  });

  it("applies speed", async () => {
    const { comp, node, stub } = mount({ speed: 2 });
    await node.ready;
    comp.setFrame(15);
    expect(stub.frames.at(-1)).toBeCloseTo(24, 6);
  });

  it("passes objectFit and objectPosition to the engine", () => {
    const { stub } = mount({ objectFit: "cover", objectPosition: "top left" });
    expect(stub.options[0]?.fit).toBe("cover");
    expect(stub.options[0]?.align).toEqual([0, 0]);
  });

  it("defaults to contain and centered", () => {
    const { stub } = mount({ objectFit: undefined, objectPosition: undefined });
    expect(stub.options[0]?.fit).toBe("contain");
    expect(stub.options[0]?.align).toEqual([0.5, 0.5]);
  });

  it("takes its intrinsic size from the animation when unsized", async () => {
    const { node } = mount({ width: undefined, height: undefined });
    await node.ready;
    expect(node.width()).toBe(200);
    expect(node.height()).toBe(200);
  });

  it("keeps an explicit size over the intrinsic one", async () => {
    const { node } = mount({ width: 320, height: 180 });
    await node.ready;
    expect(node.width()).toBe(320);
    expect(node.height()).toBe(180);
  });

  it("does not re-seek when the resolved frame is unchanged", async () => {
    const { comp, node, stub } = mount();
    await node.ready;
    comp.setFrame(15);
    const count = stub.frames.length;
    comp.setFrame(15);
    expect(stub.frames.length).toBe(count);
  });

  it("rejects src and data together", () => {
    expect(
      () => new Lottie({ src: "/a.json", data: { fake: true } }),
    ).toThrow(/mutually exclusive/i);
  });

  it("rejects neither src nor data", () => {
    expect(() => new Lottie({})).toThrow(/src.*data/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @smoove/lottie test lottie
```

Expected: FAIL — `Failed to resolve import "./lottie.js"`.

- [ ] **Step 3: Write `packages/lottie/src/lottie.ts`**

```ts
import {
  FlexShape,
  getComposition,
  type LayoutBox,
  type ObjectFit,
  type ObjectPosition,
  type SizeValue,
  TICK_MARK,
} from "@smoove/core";
import Konva from "konva";
import {
  getDefaultLottieEngineFactory,
  type LottieEngine,
  type LottieEngineOptions,
} from "./engine.js";
import { blit, createSurface, type LottieSurface, resizeSurface } from "./surface.js";
import { lottieFrameAt, type LottieTiming } from "./timing.js";
import type { LottieConfig } from "./types.js";

const LOTTIE_KEYS = [
  "src",
  "data",
  "objectFit",
  "objectPosition",
  "cornerRadius",
  "trimBefore",
  "trimAfter",
  "loop",
  "speed",
  "marker",
  "segment",
  "pixelRatio",
  "engineFactory",
] as const;

const MAX_PIXEL_RATIO = 3;

/** `objectPosition` as dotlottie's 0..1 `[x, y]` alignment pair. */
const ALIGNMENTS: Record<ObjectPosition, [number, number]> = {
  center: [0.5, 0.5],
  top: [0.5, 0],
  bottom: [0.5, 1],
  left: [0, 0.5],
  right: [1, 0.5],
  "top left": [0, 0],
  "top right": [1, 0],
  "bottom left": [0, 1],
  "bottom right": [1, 1],
};

function stripConfig(config: LottieConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const key of LOTTIE_KEYS) delete out[key];
  return out;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radii: number[],
): void {
  const [tl, tr, br, bl] = radii;
  ctx.beginPath();
  ctx.moveTo(tl, 0);
  ctx.lineTo(width - tr, 0);
  ctx.arcTo(width, 0, width, tr, tr);
  ctx.lineTo(width, height - br);
  ctx.arcTo(width, height, width - br, height, br);
  ctx.lineTo(bl, height);
  ctx.arcTo(0, height, 0, height - bl, bl);
  ctx.lineTo(0, tl);
  ctx.arcTo(0, 0, tl, 0, tl);
  ctx.closePath();
}

function normalizeCorners(value: number | number[]): number[] {
  if (typeof value === "number") return [value, value, value, value];
  const [a = 0, b = a, c = a, d = b] = value;
  return [a, b, c, d];
}

const LottieBase = FlexShape<Konva.Shape, LottieConfig>(Konva.Shape);

/**
 * A Lottie animation on the composition's clock. The engine rasterizes into an
 * offscreen surface each frame and this shape paints that surface, so the node
 * is frame-pure: `setFrame(n)` always yields the same pixels, in the browser
 * and in a headless render alike.
 */
export class Lottie extends LottieBase {
  /** Resolves once the animation is loaded. */
  readonly ready: Promise<void>;

  private readonly _engine: LottieEngine;
  private readonly _trimBefore: number;
  private readonly _trimAfter?: number;
  private readonly _loop: boolean;
  private readonly _speed: number;
  private readonly _segment?: [number, number];
  private readonly _pixelRatio?: number;
  private readonly _cornerRadius?: number[];
  private _surface: LottieSurface;
  private _loaded = false;
  private _renderGated = false;
  private _lastFrame: number | null = null;

  constructor(config: LottieConfig) {
    super(stripConfig(config) as LottieConfig);

    if (config.src !== undefined && config.data !== undefined) {
      throw new Error("[smoove] Lottie: src and data are mutually exclusive — provide one");
    }
    if (config.src === undefined && config.data === undefined) {
      throw new Error("[smoove] Lottie: one of src or data is required");
    }

    this.setAttr(TICK_MARK, true);

    this._trimBefore = config.trimBefore ?? 0;
    this._trimAfter = config.trimAfter;
    this._loop = config.loop ?? false;
    this._speed = config.speed ?? 1;
    this._segment = config.segment;
    this._pixelRatio = config.pixelRatio;
    this._cornerRadius =
      config.cornerRadius === undefined ? undefined : normalizeCorners(config.cornerRadius);

    const fit: ObjectFit = config.objectFit ?? "contain";
    const align = ALIGNMENTS[config.objectPosition ?? "center"];

    // Start at the box size we know about; _syncSurface resizes once laid out.
    const initial = this._surfaceSize();
    this._surface = createSurface(initial.width, initial.height);

    const options: LottieEngineOptions = {
      width: this._surface.width,
      height: this._surface.height,
      src: config.src,
      data: config.data,
      fit,
      align,
      marker: config.marker,
    };
    const factory = config.engineFactory ?? getDefaultLottieEngineFactory();
    this._engine = factory(options);

    this.ready = this._engine.ready
      .then(() => {
        this._loaded = true;
        this._applyIntrinsicSize();
        this.getLayer()?.batchDraw();
      })
      .catch((err: unknown) => {
        console.error("[smoove] Lottie load failed:", err);
      });

    this.sceneFunc(this._sceneFunc.bind(this) as Konva.Shape["sceneFunc"]);
    this.hitFunc(((ctx: Konva.Context, shape: Konva.Shape) => {
      ctx.beginPath();
      ctx.rect(0, 0, this.width(), this.height());
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    }) as Konva.Shape["hitFunc"]);

    this.on("widthChange heightChange", () => this._syncSurface());
  }

  /** Size the animation to itself when the author gave no explicit size. */
  private _applyIntrinsicSize(): void {
    const size = this._engine.intrinsicSize;
    if (!size) return;
    if ((this.attrs.flexWidth as SizeValue | undefined) === undefined) this.width(size.width);
    if ((this.attrs.flexHeight as SizeValue | undefined) === undefined) this.height(size.height);
    this._syncSurface();
  }

  private _effectivePixelRatio(): number {
    if (this._pixelRatio !== undefined) return Math.max(0.1, this._pixelRatio);
    const stage = this.getStage();
    const ratio = stage?.getLayers()[0]?.getCanvas().getPixelRatio() ?? 1;
    return Math.min(MAX_PIXEL_RATIO, Math.max(0.1, ratio));
  }

  private _surfaceSize(): { width: number; height: number } {
    const ratio = this._effectivePixelRatio();
    return {
      width: Math.max(1, Math.round(Math.max(1, this.width()) * ratio)),
      height: Math.max(1, Math.round(Math.max(1, this.height()) * ratio)),
    };
  }

  /** Keep the engine surface matched to the node's box at output resolution. */
  private _syncSurface(): void {
    const { width, height } = this._surfaceSize();
    if (width === this._surface.width && height === this._surface.height) return;
    this._surface = resizeSurface(this._surface, width, height);
    this._engine.resize(width, height);
    this._lastFrame = null;
  }

  private _timing(fps: number): LottieTiming {
    const [segStart, segEnd] = this._segment ?? this._engine.segment;
    return {
      fps,
      lottieFps: this._engine.fps,
      totalFrames: this._engine.totalFrames,
      trimBefore: this._trimBefore,
      trimAfter: this._trimAfter,
      loop: this._loop,
      speed: this._speed,
      segment: [segStart, segEnd],
    };
  }

  /**
   * @internal — called by `Sequence`/`Clip` each tick while on-stage. Gates the
   * offline render on the load, then seeks the engine and blits the frame.
   */
  _kmTick(localFrame: number): void {
    const stage = this.getStage();
    const comp = stage ? getComposition(stage) : null;

    if (!this._renderGated && !this._loaded && comp?.environment.isRendering) {
      this._renderGated = true;
      const handle = comp.delayRender("load lottie");
      this.ready.finally(() => comp.continueRender(handle));
    }
    if (!this._loaded) return;

    this._syncSurface();
    const frame = lottieFrameAt(localFrame, this._timing(comp?.fps ?? 0));
    if (this._lastFrame === frame) return;
    this._lastFrame = frame;
    this._engine.setFrame(frame);
    blit(this._surface, this._engine.buffer);
  }

  /** @internal — called when the host timeline leaves range. */
  _kmDeactivate(): void {}

  private _sceneFunc(context: Konva.Context): void {
    if (!this._loaded) return;
    const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
    const w = this.width();
    const h = this.height();
    if (w <= 0 || h <= 0) return;
    ctx.save();
    if (this._cornerRadius) {
      roundRectPath(ctx, w, h, this._cornerRadius);
      ctx.clip();
    }
    ctx.drawImage(this._surface.canvas, 0, 0, w, h);
    ctx.restore();
  }

  /** Release the engine's WASM resources. */
  override destroy(): this {
    this._engine.destroy();
    return super.destroy();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @smoove/lottie test lottie
```

Expected: PASS, 11 tests.

Likely fixes if they do not:
- If `TICK_MARK` or `getComposition` are not exported from `@smoove/core`, check `packages/core/src/index.ts` and import what is actually there.
- If `getPixelRatio()` is unavailable on a detached node, the `?? 1` fallback covers it — confirm the surface still resizes once mounted.
- The composition must register the node's load with the preview buffer gate too; that is Step 5.

- [ ] **Step 5: Add the preview buffering gate**

The render gate covers offline rendering; preview needs the composition's asset gate so playback holds until the animation is ready. In the constructor, right after `this.ready` is assigned, append:

```ts
    // Preview: hold playback until the animation is ready, the same way
    // `Image` and `Font` do. Deferred to a microtask so the node has had a
    // chance to be added to a composition.
    queueMicrotask(() => {
      const stage = this.getStage();
      const comp = stage ? getComposition(stage) : null;
      if (comp && !comp.environment.isRendering) comp.registerAsset(this.ready);
    });
```

- [ ] **Step 6: Re-run the tests**

```bash
pnpm --filter @smoove/lottie test
```

Expected: PASS, all suites (timing 14, engine 6, surface 6, node 11).

- [ ] **Step 7: Checkpoint**

```bash
pnpm --filter @smoove/lottie test && pnpm --filter @smoove/lottie build && pnpm check
```

---

## Task 9: `index.ts` — the public barrel

**Files:**
- Modify: `packages/lottie/src/index.ts`

- [ ] **Step 1: Write the barrel**

Replace the placeholder in `packages/lottie/src/index.ts`:

```ts
/**
 * @smoove/lottie — timeline-driven Lottie animations for smoove.
 *
 * Importing this module registers the dotlottie-web engine as the default, so
 * a `Lottie` node needs no setup. The engine rasterizes with ThorVG/WASM into a
 * DOM-free surface, which is why preview and headless render produce the same
 * pixels.
 */
import { createDotLottieEngine } from "./dotlottie-engine.js";
import { setDefaultLottieEngineFactory } from "./engine.js";

setDefaultLottieEngineFactory(createDotLottieEngine);

export { createDotLottieEngine } from "./dotlottie-engine.js";
export {
  getDefaultLottieEngineFactory,
  type LottieEngine,
  type LottieEngineFactory,
  type LottieEngineOptions,
  setDefaultLottieEngineFactory,
} from "./engine.js";
export { Lottie } from "./lottie.js";
export {
  lottieFrameAt,
  type LottieTiming,
  naturalDurationInFrames,
  resolveSegment,
} from "./timing.js";
export type { LottieConfig, LottieData } from "./types.js";
export { setLottieWasmUrl } from "./wasm.js";
```

`surface.ts` stays internal — nothing outside the node needs it.

- [ ] **Step 2: Checkpoint**

```bash
pnpm --filter @smoove/lottie build && pnpm --filter @smoove/lottie test && pnpm check
```

---

## Task 10: End-to-end check in a real headless render

Unit tests stub or bypass the full stack. This proves the node paints real pixels through Konva's skia backend, which is the thing that would silently break.

**Files:**
- Test: `packages/lottie/src/lottie-render.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/lottie/src/lottie-render.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { Composition, Sequence } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { Lottie } from "./index.js";

const probe = JSON.parse(
  readFileSync(new URL("./fixtures/probe.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

/** Alpha-weighted centroid x of the stage, or -1 when nothing is painted. */
function centroidX(comp: Composition): number {
  const canvas = comp.captureCanvas();
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  let weight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        sum += x * alpha;
        weight += alpha;
      }
    }
  }
  return weight === 0 ? -1 : sum / weight;
}

describe("Lottie in a real composition", () => {
  it("paints, and the animation advances with the frame", async () => {
    const comp = new Composition({
      id: "lottie-render",
      fps: 30,
      durationInFrames: 60,
      width: 200,
      height: 200,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const node = new Lottie({ data: probe, width: 200, height: 200 });
    seq.add(node);
    comp.add(seq);

    await node.ready;

    comp.setFrame(0);
    comp.draw();
    const start = centroidX(comp);

    comp.setFrame(55);
    comp.draw();
    const end = centroidX(comp);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm --filter @smoove/lottie test lottie-render
```

Expected: PASS.

If `comp.draw()` or `comp.captureCanvas()` are named differently, read `packages/core/src/engine/composition.ts` and use the real names — `captureCanvas()` is referenced in the codebase already. If nothing is painted, check in this order: the surface is non-zero-sized (`_syncSurface` ran), `_kmTick` was reached (the node is `TICK_MARK`ed and inside an in-range `Sequence`), and the blit landed (`blit` returned early on a short buffer).

- [ ] **Step 3: Checkpoint**

```bash
pnpm --filter @smoove/lottie test && pnpm check
```

---

## Task 11: Kitchen-sink composition

**Files:**
- Create: `packages/kitchen-sink/src/compositions/lottie/index.ts`
- Create: `packages/kitchen-sink/src/compositions/lottie/composition.ts`
- Create: `packages/kitchen-sink/public/lottie/` (holds the sample animation)
- Modify: `packages/kitchen-sink/package.json` (add the dependency)
- Modify: `packages/kitchen-sink/src/registry.ts`

- [ ] **Step 1: Add the dependency**

In `packages/kitchen-sink/package.json`, add to `dependencies`:

```json
    "@smoove/lottie": "workspace:*",
```

Then:

```bash
pnpm install
```

- [ ] **Step 2: Add a sample animation**

Put a small Creative-Commons or public-domain `.json` Lottie at
`packages/kitchen-sink/public/lottie/sample.json`. LottieFiles' free library is
the usual source. Record its origin and licence in a one-line comment at the top
of `composition.ts` — do not commit an animation whose licence you cannot name.
If nothing suitable is at hand, copy `packages/lottie/src/fixtures/probe.json`;
it is ours and it animates.

- [ ] **Step 3: Write the composition**

Create `packages/kitchen-sink/src/compositions/lottie/composition.ts`. **Invoke the `smoove-video` skill before writing this file** — it is composition code, and the repo requires that skill for any composition work. The shape to aim for:

```ts
// Animation: <name>, <source URL>, <licence>.
import { Composition, Flex, Sequence, Text, interpolate } from "@smoove/core";
import { Lottie } from "@smoove/lottie";

export default function composition(): Composition {
  const comp = new Composition({
    id: "lottie",
    fps: 30,
    durationInFrames: 180,
    width: 1280,
    height: 720,
  });

  const seq = new Sequence({ from: 0, durationInFrames: 180 });
  const row = new Flex({
    width: "100%",
    height: "100%",
    direction: "row",
    align: "center",
    justify: "center",
    gap: 48,
  });

  // Left: playing on the composition clock, looping.
  const looping = new Lottie({
    src: "/lottie/sample.json",
    width: 360,
    height: 360,
    loop: true,
  });

  // Right: the same animation at half speed, to show the resampling.
  const slow = new Lottie({
    src: "/lottie/sample.json",
    width: 360,
    height: 360,
    loop: true,
    speed: 0.5,
  });

  row.add(looping, slow);
  seq.add(row);
  comp.add(seq);
  return comp;
}
```

Check the real `Flex` prop names against `skills/smoove-video` before writing — `direction`/`align`/`justify` are the shape to confirm, not to assume.

- [ ] **Step 4: Write the registry entry**

Create `packages/kitchen-sink/src/compositions/lottie/index.ts`:

```ts
import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "lottie",
  title: "Lottie",
  group: "Media",
  description:
    "@smoove/lottie plays After Effects animations off the composition clock, resampling the animation's own frame rate onto yours.",
  tags: ["lottie", "dotlottie", "media"],
  composition: () => import("./composition.js"),
};

export default entry;
```

Confirm `"Media"` is a group the registry already uses (`audiogram` is in it) — if the group list is declared explicitly in `registry.ts`, matching an existing name avoids adding one.

- [ ] **Step 5: Register it**

In `packages/kitchen-sink/src/registry.ts`, add the import alongside the other media imports:

```ts
import lottie from "./compositions/lottie/index.js";
```

and add `lottie` to the entry array passed to `defineRegistry()`. Follow the existing alphabetical-ish grouping and comment headers.

- [ ] **Step 6: Verify in the studio**

```bash
pnpm build && pnpm dev
```

Open the studio, select the Lottie composition, scrub the timeline. Expected: both animations play, the right one at half the left one's rate, and scrubbing backwards is smooth (frame-pure, no drift).

- [ ] **Step 7: Verify a server render**

From the studio's render dialog, render the Lottie composition to mp4. Expected: the mp4 shows the animation, matching the preview. This is the check that the `data:`-URL WASM path works with no network and that the skia blit lands.

- [ ] **Step 8: Checkpoint**

```bash
pnpm build && pnpm check
```

---

## Task 12: Docs and prose

**Files:**
- Create: `packages/lottie/README.md`
- Create: `packages/docs/content/docs/<section>/lottie.mdx`
- Create: `packages/docs/src/demos/lottie.ts`
- Modify: `doc/README.md`
- Create: `.changeset/<name>.md`

- [ ] **Step 1: Invoke the `smoove-writing` skill**

Every file in this task is smoove prose. The repo requires that skill before writing any of it, and Rotem has corrected this twice. Invoke it first, then write.

- [ ] **Step 2: Write `packages/lottie/README.md`**

Cover: what it does, install, the smallest working example, how frame mapping works (composition fps versus the animation's own fps), `speed`/`loop`/`trim`/`segment`/`marker`, self-hosting the WASM with `setLottieWasmUrl`, and the headless-render story. Keep it to the length the other package READMEs run.

- [ ] **Step 3: Add a docs page with a live demo**

Follow `packages/docs/src/demos/` for the demo module shape and an existing `.mdx` page for the frontmatter and `<Demo name="..." />` usage. Add the page to the containing folder's `meta.json` so it appears in the sidebar.

- [ ] **Step 4: Update `doc/README.md`**

`AGENTS.md` requires it whenever public API changes: add `Lottie` to the API guide next to `Image`/`Video`.

- [ ] **Step 5: Update `AGENTS.md`'s layout table**

Add a `packages/lottie` row describing the package, matching the style of the `packages/code` and `packages/media` rows. `AGENTS.md` is the repo's single source of truth for layout, so a new package belongs in it.

- [ ] **Step 6: Write the changeset**

```bash
pnpm changeset
```

Select `@smoove/lottie` (the `fixed` group pulls the rest along). Per the repo's pre-1.0 convention, a purely additive feature is a **patch**. Write the summary as user-facing prose, not a commit log.

- [ ] **Step 7: Checkpoint**

```bash
pnpm build && pnpm check
```

---

## Task 13: Final verification

- [ ] **Step 1: Full build**

```bash
pnpm build
```

Expected: every package builds, including `@smoove/lottie`.

- [ ] **Step 2: Full test run**

```bash
pnpm --filter @smoove/lottie test && pnpm --filter @smoove/core test && pnpm --filter @smoove/code test
```

Expected: all pass. Note that `@smoove/kitchen-sink` has pre-existing typecheck failures unrelated to this work — do not chase them, but do not add to them either.

- [ ] **Step 3: Lint and format**

```bash
pnpm check
```

Expected: no errors. Run `pnpm format` if it reports formatting diffs.

- [ ] **Step 4: Confirm the browser bundle stays clean**

```bash
pnpm --filter @smoove/kitchen-sink build
```

Expected: the Vite build succeeds and does not warn about externalizing `node:module` or `node:fs/promises`. If it does warn, the guard in `wasm.ts` is being followed statically — make the dynamic imports harder to analyze (assign the specifier to a variable first) rather than deleting the Node path.

- [ ] **Step 5: Report, do not commit**

Leave everything in the working tree on `shemi/smoove-lottie`. Summarize for Rotem: what was built, the test counts, the render verification, and the two maintainer follow-ups — the npm trusted-publisher registration for `@smoove/lottie`, and the licence of the sample animation added to `kitchen-sink`.

---

## Self-review notes

Checked against the spec:

- Engine choice, DOM-free rendering, `data:`-URL WASM — Tasks 5, 6.
- Frame mapping via `getMediaTime`, fps resampling, loop, trims, speed, segment/marker — Task 3, wired in Task 8.
- `FlexShape` leaf, `TICK_MARK`, layout contract, intrinsic sizing — Task 8.
- Rendering path (RenderSurface → RGBA → `Konva.Util.createCanvasElement` → `sceneFunc`), `pixelRatio` scaling — Tasks 7, 8.
- Both async gates (`registerAsset` for preview, `delayRender` for render) — Task 8, Steps 3 and 5.
- Engine seam — Task 4, exercised by the stub in Task 8.
- Test plan (timing, surface, engine, node) — Tasks 3, 6, 7, 8, plus the end-to-end pass in Task 10 that the spec implied but did not name.
- Integration (kitchen-sink, docs, `doc/README.md`) — Tasks 11, 12.
- Changesets `fixed` group and the trusted-publisher flag — Task 1 Step 7, Task 12 Step 6, Task 13 Step 5.

Names are consistent across tasks: `createSurface`/`resizeSurface`/`blit`, `lottieFrameAt`/`naturalDurationInFrames`/`resolveSegment`, `LottieEngine.intrinsicSize`/`segment`/`ready`, `setLottieWasmUrl`/`ensureLottieWasm`.
