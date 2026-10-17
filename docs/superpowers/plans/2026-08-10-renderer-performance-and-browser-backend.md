# Renderer performance and browser backend implementation plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute
> **inline in the main session**, task by task. Do not dispatch subagents to implement
> this: the repo owner has ruled that out.
>
> **Never run `git commit`.** Repo convention (`AGENTS.md`) is that changes stay in the
> working tree and the owner commits. Each task therefore ends in a **checkpoint** step
> (run the verification, confirm the output) instead of a commit step.

**Goal:** Keep server render cost flat over long renders, guard that property with a test
that provably catches the regression, and add a browser rendering backend as a second,
opt-in path alongside the skia one.

**Architecture:** Part 1 closes out the GL readback display-list leak (fix already applied)
with a calibrated growth regression test. Part 2 adds `@smoove/renderer-browser`, a
separate package that bundles a composition with Vite, drives it in headless Chrome across
several pages in parallel, encodes frames in-page with WebCodecs, and muxes the resulting
packets in Node through the existing mediabunny `Output`. Audio stays entirely Node-side.

**Tech stack:** TypeScript, Vitest, skia-canvas, headless-gl, mediabunny (+ `@mediabunny/server`),
Vite programmatic API, `puppeteer-core`, WebCodecs.

**Source spec:** `docs/superpowers/specs/2026-08-10-renderer-performance-and-browser-backend-design.md`

---

# Part 1 — the existing Node renderer

Part 1 is independently shippable. Stop after Task 1 and you have a complete, valuable
change.

## Task 1: Growth regression test

The fix itself (`ctx.reset()` in `packages/renderer/src/gl-node.ts`) is **already applied**
in the working tree, along with `.changeset/flat-frame-costs.md`. This task adds the test
that stops it regressing.

**Why this test looks the way it does.** The bug is that per-frame cost *grows*; the average
stays fine for a long time. So the assertion is a ratio of last-quartile mean to
first-quartile mean, never an absolute millisecond figure, which would be flaky across
machines.

**The constants below are measured, not guessed.** A naive version of this test (one effect
node, 320x180, 160 frames) scores 0.72x against the *broken* build, so it would pass and
catch nothing. Accumulation rate scales with readbacks-per-frame times region area, so the
test uses 9 effect nodes to reach a signal. Measured on this machine:

| build | ratio | runtime |
| --- | --- | --- |
| fixed | 0.60x | 1.9 s |
| broken | 2.62x | - |

A threshold of **1.5** sits with roughly 2.5x margin on both sides.

**Files:**
- Create: `packages/renderer/src/effects-growth.test.ts`
- Reference (do not modify): `packages/renderer/src/effects-determinism.test.ts` (same rig)
- Reference (do not modify): `packages/renderer/src/gl-node.ts:66-81` (the fix under test)

- [ ] **Step 1: Write the test**

Create `packages/renderer/src/effects-growth.test.ts`:

```ts
import "./register.js";
import { Composition, Sequence, Text } from "@smoove/core";
import { flameWrap } from "@smoove/effects";
import { beforeAll, expect, it } from "vitest";
import { enableNodeShaderTransitions } from "./gl.js";

/**
 * Long renders must cost the same per frame at the end as at the start.
 *
 * skia-canvas records draw commands forever, and any long-lived canvas that is
 * both drawn to and read from will replay its whole history on every read. That
 * makes a render quadratic in frame count: fine for 50 frames, unusable at 1200.
 * It has now shipped twice (see doc/effects-performance-research.md S0, and the
 * GL readback canvas in gl-node.ts).
 *
 * The assertion is a GROWTH RATIO, never an absolute duration, so it does not go
 * flaky on a slower machine. Nine effect nodes are not decoration: accumulation
 * scales with readbacks-per-frame times region area, and at one node this test
 * scores 0.72x against a known-broken build, i.e. it would catch nothing.
 */
const FRAMES = 160;
const WIDTH = 320;
const HEIGHT = 180;
const NODES = 9;
const QUARTILE = FRAMES / 4;

/** Measured: 0.60x with the fix, 2.62x without it. */
const MAX_GROWTH = 1.5;

function buildComp(): Composition {
  const comp = new Composition({
    id: "effects-growth",
    width: WIDTH,
    height: HEIGHT,
    fps: 30,
    durationInFrames: FRAMES,
  });
  const seq = new Sequence({ from: 0, durationInFrames: FRAMES });
  for (let i = 0; i < NODES; i++) {
    const title = new Text({
      x: WIDTH * 0.1 + (i % 3) * WIDTH * 0.28,
      y: HEIGHT * 0.1 + Math.floor(i / 3) * HEIGHT * 0.25,
      text: "BURN",
      fontSize: Math.round(HEIGHT * 0.14),
      fill: "white",
    });
    title.setAttr("effects", [flameWrap({ intensity: 0.9, height: Math.round(HEIGHT / 6) })]);
    seq.add(title);
  }
  comp.add(seq);
  return comp;
}

/** One frame, including the pixel read. The read is what replays a display list, so it
 *  must be inside the timing window or the test measures nothing. */
function frameCostMs(comp: Composition, frame: number): number {
  const t0 = process.hrtime.bigint();
  comp.setFrame(frame);
  const canvas = comp.captureCanvas();
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.getImageData(0, 0, canvas.width, canvas.height);
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

beforeAll(() => {
  // Without this the shader passes are skipped, the readback canvas is never
  // touched, and the test would pass against any build at all.
  enableNodeShaderTransitions();
});

it("per-frame cost does not grow over a long render", () => {
  const comp = buildComp();
  const times: number[] = [];
  for (let frame = 0; frame < FRAMES; frame++) times.push(frameCostMs(comp, frame));

  const first = mean(times.slice(0, QUARTILE));
  const last = mean(times.slice(-QUARTILE));
  const growth = last / first;

  expect(
    growth,
    `per-frame cost grew ${growth.toFixed(2)}x over ${FRAMES} frames ` +
      `(first quartile ${first.toFixed(2)}ms, last ${last.toFixed(2)}ms). ` +
      "Something long-lived is accumulating a skia display list. Look for a canvas " +
      "that is drawn to and read from every frame without ctx.reset().",
  ).toBeLessThan(MAX_GROWTH);
});
```

- [ ] **Step 2: Run it and confirm it passes on the fixed build**

```bash
pnpm --filter @smoove/renderer exec vitest run src/effects-growth.test.ts
```

Expected: PASS, in roughly 2 to 4 seconds.

- [ ] **Step 3: Prove the test actually catches the bug**

A regression test that has never seen the regression is decoration. Temporarily disable the
fix in `packages/renderer/src/gl-node.ts` by commenting out line 73:

```ts
      // (ctx as unknown as { reset?: () => void }).reset?.();
```

- [ ] **Step 4: Run it again and confirm it now FAILS**

```bash
pnpm --filter @smoove/renderer exec vitest run src/effects-growth.test.ts
```

Expected: FAIL, with a growth ratio around 2.6x and the diagnostic message above.

If it passes, the test is worthless as written. Do not lower `MAX_GROWTH`; raise the signal
instead, in this order: `FRAMES` to 240, then `NODES` to 12. Re-run Steps 2 and 4 after any
change so both directions stay verified.

- [ ] **Step 5: Restore the fix**

Uncomment line 73. Re-run Step 2 and confirm PASS again.

- [ ] **Step 6: Confirm the whole renderer suite is green**

```bash
pnpm --filter @smoove/renderer test
```

Expected: all files pass, including the pre-existing effects, blur, chroma-key and
determinism suites.

- [ ] **Step 7: Lint**

```bash
pnpm check
```

Expected: no errors. Biome needs explicit paths in a fresh worktree; if it complains about
having no files, pass `packages/renderer/src`.

- [ ] **Step 8: Checkpoint**

Confirm `git status` shows exactly: modified `packages/renderer/src/gl-node.ts`, new
`packages/renderer/src/effects-growth.test.ts`, new `.changeset/flat-frame-costs.md`.
Report the passing output. Do not commit.

- [ ] **Step 9: Decide on the profiler scripts**

`packages/kitchen-sink/scripts/profile-render.mjs` and `profile-bootstrap.ts` are untracked
in the working tree. They are the manual deep-dive tool for when this test trips: they
report per-frame timing buckets, RSS, and GL object churn on any registry composition.

```bash
node --expose-gc packages/kitchen-sink/scripts/profile-render.mjs flame-wrap 400
```

Ask the owner whether to keep them in the repo or delete them. Do not decide unilaterally.

---

# Part 2 — `@smoove/renderer-browser`

**Do not start Part 2 until Task 2 has answered its question.** Task 2 is a gate, not a
warm-up.

## Task 2: SPS/PPS concatenation spike (GATE)

The parallel design rests on one unverified assumption: that H.264 packets produced by
*separate* `VideoEncoder` instances, configured identically, share byte-identical SPS/PPS,
so slices can be concatenated at the packet level without re-encoding. mediabunny takes the
decoder config from the **first** `add()` call's `meta`, so if configs differ across slices
the later slices decode as garbage.

This is throwaway code whose only output is an answer. Write it in the scratchpad, not the
repo.

**Files:**
- Create: `<scratchpad>/spike-sps.mjs` (throwaway)

- [ ] **Step 1: Write the spike**

It must run in the browser, because that is where the encoders will live. Create
`<scratchpad>/spike-sps.html`:

```html
<canvas id="c" width="320" height="180"></canvas>
<pre id="out"></pre>
<script type="module">
const config = {
  codec: "avc1.42001f",
  width: 320,
  height: 180,
  bitrate: 1_000_000,
  framerate: 30,
  latencyMode: "quality",
};

/** Encode `n` frames on a fresh encoder, return its decoder description bytes. */
async function descriptionFor(seed) {
  const canvas = new OffscreenCanvas(320, 180);
  const ctx = canvas.getContext("2d");
  let description = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (!description && meta?.decoderConfig?.description) {
        description = new Uint8Array(meta.decoderConfig.description);
      }
    },
    error: (e) => { document.getElementById("out").textContent = "encoder error: " + e; },
  });
  encoder.configure(config);
  for (let i = 0; i < 4; i++) {
    // Different content per "slice", which is the realistic case.
    ctx.fillStyle = `hsl(${(seed * 60 + i * 10) % 360} 80% 50%)`;
    ctx.fillRect(0, 0, 320, 180);
    const frame = new VideoFrame(canvas, { timestamp: i * 33333 });
    encoder.encode(frame, { keyFrame: i === 0 });
    frame.close();
  }
  await encoder.flush();
  encoder.close();
  return description;
}

const a = await descriptionFor(0);
const b = await descriptionFor(3);
const same =
  a && b && a.length === b.length && a.every((v, i) => v === b[i]);
document.getElementById("out").textContent = JSON.stringify(
  {
    supported: (await VideoEncoder.isConfigSupported(config)).supported,
    lengthA: a?.length ?? null,
    lengthB: b?.length ?? null,
    identical: same,
    hexA: a ? [...a].map((x) => x.toString(16).padStart(2, "0")).join("") : null,
    hexB: b ? [...b].map((x) => x.toString(16).padStart(2, "0")).join("") : null,
  },
  null,
  2,
);
</script>
```

- [ ] **Step 2: Serve and open it**

```bash
npx --yes serve -l 4599 <scratchpad>
```

Then open `http://localhost:4599/spike-sps.html` with the Browser pane (`preview_start`
with that url) and read the `<pre>` with `get_page_text`.

- [ ] **Step 3: Record the answer**

Expected on macOS Chrome: `supported: true` and `identical: true`.

Write the result into the spec file under section 2.6 as a resolved note, including the hex
of the description, so nobody re-litigates it later.

- [ ] **Step 4: Branch on the result**

- `identical: true` -> proceed with Part 2 as planned. Slices concatenate directly.
- `identical: false` -> **stop and report to the owner before continuing.** The fallback is
  a single `VideoEncoder` in one page fed by N rendering pages over a `MessageChannel`,
  which keeps the rendering parallelism and serializes only the encode. That is a different
  Task 9 and the owner should choose it knowingly.
- `supported: false` -> the machine's Chrome has no H.264 encoder. Re-run with
  `codec: "vp09.00.10.08"` and plan the default container as webm, and treat the
  screenshot path (Task 11) as the mp4 route.

- [ ] **Step 5: Checkpoint**

Report the JSON verbatim. Delete the scratchpad files. Do not commit anything.

## Task 3: Package scaffold

**Files:**
- Create: `packages/renderer-browser/package.json`
- Create: `packages/renderer-browser/tsconfig.json`
- Create: `packages/renderer-browser/src/index.ts`
- Create: `packages/renderer-browser/src/types.ts`
- Modify: `.changeset/config.json` (add to the `fixed` array)
- Modify: `tsconfig.json` at repo root (add a project reference)

- [ ] **Step 1: Write `packages/renderer-browser/package.json`**

Model it on `packages/renderer/package.json`. `puppeteer-core`, not `puppeteer`: the latter
downloads a browser at install time, which is unacceptable for the "users' machines and CI"
target.

```json
{
  "name": "@smoove/renderer-browser",
  "version": "0.3.6",
  "description": "Browser rendering backend for smoove. Runs a composition in headless Chrome and encodes frames with WebCodecs.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/smoove-dev/smoove.git",
    "directory": "packages/renderer-browser"
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
  "files": ["dist"],
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "clean": "rm -rf dist *.tsbuildinfo",
    "test": "vitest run",
    "prepublishOnly": "pnpm build"
  },
  "dependencies": {
    "@smoove/renderer": "workspace:^",
    "@smoove/vite": "workspace:^",
    "mediabunny": "^1.49.0",
    "puppeteer-core": "^23.0.0",
    "vite": "^6.3.6"
  },
  "devDependencies": {
    "@smoove/core": "workspace:^",
    "@smoove/effects": "workspace:^",
    "@types/node": "^22.10.0",
    "typescript": "^5.6.3",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "@smoove/core": "workspace:^",
    "konva": ">=10"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Write `packages/renderer-browser/tsconfig.json`**

Copy `packages/renderer/tsconfig.json` verbatim first, then adjust its `references` to point
at `../core`, `../renderer`, and `../vite`. Read the renderer one before writing; do not
invent the compiler options, they must match the repo's `composite: true` project-reference
setup.

- [ ] **Step 3: Register the package for releases**

In `.changeset/config.json`, add `"@smoove/renderer-browser"` to the single array inside
`fixed`. Repo convention: every published package versions in lockstep, and a new package
that is missing from this array breaks the release.

- [ ] **Step 4: Add the root project reference**

In the root `tsconfig.json` solution file, add `{ "path": "./packages/renderer-browser" }`
alongside the existing package references.

- [ ] **Step 5: Write the public type surface**

`packages/renderer-browser/src/types.ts`:

```ts
import type { RenderOptions, RenderProgress, RenderResult } from "@smoove/renderer";

export type { RenderOptions, RenderProgress, RenderResult };

/** A built, served composition bundle. `close()` stops the local server. */
export interface Bundle {
  /** Origin the harness page is served from, e.g. "http://127.0.0.1:41233". */
  url: string;
  close(): Promise<void>;
}

export interface BundleOptions {
  /** Path to the module whose default export is the Composition. */
  entry: string;
  /** Project root Vite resolves from. Defaults to the entry's directory. */
  root?: string;
}

export interface BrowserRenderOptions extends RenderOptions {
  bundle: Bundle;
  /** Pages rendering slices concurrently. Defaults to min(cores - 1, 4). */
  concurrency?: number;
  /** Path to a Chrome/Chromium executable, overriding discovery. */
  executablePath?: string;
}
```

- [ ] **Step 6: Write a placeholder barrel**

`packages/renderer-browser/src/index.ts`:

```ts
export type {
  Bundle,
  BundleOptions,
  BrowserRenderOptions,
  RenderOptions,
  RenderProgress,
  RenderResult,
} from "./types.js";
```

- [ ] **Step 7: Install and build**

```bash
pnpm install
pnpm --filter @smoove/renderer-browser build
```

Expected: both succeed, `packages/renderer-browser/dist/index.js` exists.

- [ ] **Step 8: Checkpoint**

Run `pnpm build` at the repo root and confirm every package still builds. Do not commit.

## Task 4: Chrome resolver

**Files:**
- Create: `packages/renderer-browser/src/chrome.ts`
- Test: `packages/renderer-browser/src/chrome.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/renderer-browser/src/chrome.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveChromePath } from "./chrome.js";

describe("resolveChromePath", () => {
  it("prefers an explicit path over everything else", () => {
    expect(resolveChromePath({ executablePath: "/tmp/my-chrome" })).toBe("/tmp/my-chrome");
  });

  it("falls back to SMOOVE_CHROME_PATH", () => {
    expect(resolveChromePath({ env: { SMOOVE_CHROME_PATH: "/tmp/env-chrome" } })).toBe(
      "/tmp/env-chrome",
    );
  });

  it("prefers SMOOVE_CHROME_PATH over PUPPETEER_EXECUTABLE_PATH", () => {
    expect(
      resolveChromePath({
        env: { SMOOVE_CHROME_PATH: "/tmp/a", PUPPETEER_EXECUTABLE_PATH: "/tmp/b" },
      }),
    ).toBe("/tmp/a");
  });

  it("names all three remedies when nothing resolves", () => {
    const call = () => resolveChromePath({ env: {}, candidates: [] });
    expect(call).toThrow(/SMOOVE_CHROME_PATH/);
    expect(call).toThrow(/install/i);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/chrome.test.ts
```

Expected: FAIL, "Failed to resolve import ./chrome.js".

- [ ] **Step 3: Implement**

`packages/renderer-browser/src/chrome.ts`:

```ts
import { existsSync } from "node:fs";

/** Well-known install locations, most preferred first. */
const MAC = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const LINUX = [
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
];

export interface ResolveOptions {
  executablePath?: string;
  env?: Record<string, string | undefined>;
  /** Injectable for tests; defaults to the platform list. */
  candidates?: readonly string[];
  exists?: (path: string) => boolean;
}

/**
 * Find a Chrome to drive, without ever downloading one implicitly. A silent
 * few-hundred-megabyte install on `npm install` is not acceptable for a package
 * people add to CI, so the download is opt-in and this throws with instructions
 * rather than fetching anything.
 */
export function resolveChromePath(opts: ResolveOptions = {}): string {
  const env = opts.env ?? process.env;
  const exists = opts.exists ?? existsSync;

  if (opts.executablePath) return opts.executablePath;
  if (env.SMOOVE_CHROME_PATH) return env.SMOOVE_CHROME_PATH;
  if (env.PUPPETEER_EXECUTABLE_PATH) return env.PUPPETEER_EXECUTABLE_PATH;

  const candidates = opts.candidates ?? (process.platform === "darwin" ? MAC : LINUX);
  for (const candidate of candidates) if (exists(candidate)) return candidate;

  throw new Error(
    "@smoove/renderer-browser could not find a browser to render with. Either " +
      "set SMOOVE_CHROME_PATH to a Chrome, Chromium or Edge executable, pass " +
      "`executablePath` to the render call, or install one with " +
      "`npx @puppeteer/browsers install chrome@stable`.",
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/chrome.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Checkpoint**

Report the passing output. Do not commit.

## Task 5: Bundler

**Files:**
- Create: `packages/renderer-browser/src/bundle.ts`
- Create: `packages/renderer-browser/src/harness/entry-template.ts`
- Test: `packages/renderer-browser/src/bundle.test.ts`

- [ ] **Step 1: Write the failing test**

This test builds a real composition module and asserts the served page boots. It is slow by
unit-test standards and that is correct: a bundler test that stubs Vite tests nothing.

`packages/renderer-browser/src/bundle.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { bundleComposition } from "./bundle.js";
import type { Bundle } from "./types.js";

let bundle: Bundle | undefined;

afterAll(async () => {
  await bundle?.close();
});

it("serves a page that exposes the harness", async () => {
  const dir = await mkdtemp(join(tmpdir(), "smoove-bundle-"));
  const entry = join(dir, "composition.ts");
  await writeFile(
    entry,
    `import { Composition, Sequence, Text } from "@smoove/core";
     const comp = new Composition({ id: "t", width: 160, height: 90, fps: 30, durationInFrames: 10 });
     const seq = new Sequence({ from: 0, durationInFrames: 10 });
     seq.add(new Text({ x: 10, y: 10, text: "hi", fontSize: 20, fill: "white" }));
     comp.add(seq);
     export default comp;`,
  );

  bundle = await bundleComposition({ entry });
  expect(bundle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

  const html = await fetch(bundle.url).then((r) => r.text());
  expect(html).toContain("<canvas");
}, 120_000);
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/bundle.test.ts
```

Expected: FAIL, cannot resolve `./bundle.js`.

- [ ] **Step 3: Write the entry template**

`packages/renderer-browser/src/harness/entry-template.ts` exports a function producing the
virtual entry module's source. It imports the user's composition and the harness runtime,
which Task 6 fills in.

```ts
/** Source for the generated entry module Vite builds. `entryPath` is absolute. */
export function entrySource(entryPath: string): string {
  return `import comp from ${JSON.stringify(entryPath)};
import { install } from "@smoove/renderer-browser/harness";
install(comp);
`;
}
```

- [ ] **Step 4: Implement the bundler**

`packages/renderer-browser/src/bundle.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { smoove } from "@smoove/vite";
import { createServer } from "vite";
import { entrySource } from "./harness/entry-template.js";
import type { Bundle, BundleOptions } from "./types.js";

/**
 * Build and serve a composition for the browser backend.
 *
 * A Vite dev server in middleware-free mode is used rather than a production
 * build: it resolves the workspace's `@smoove/*` packages and the smoove plugin's
 * media/font URL rewriting the same way the studio does, so what renders here is
 * what the author previewed.
 */
export async function bundleComposition(opts: BundleOptions): Promise<Bundle> {
  const entry = resolve(opts.entry);
  const root = opts.root ?? dirname(entry);

  const dir = await mkdtemp(join(tmpdir(), "smoove-harness-"));
  const generated = join(dir, "entry.ts");
  await writeFile(generated, entrySource(entry));
  await writeFile(
    join(dir, "index.html"),
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;background:#000}</style>
     <canvas id="smoove-stage"></canvas>
     <script type="module" src="/entry.ts"></script>`,
  );

  const server = await createServer({
    configFile: false,
    root: dir,
    plugins: [smoove()],
    resolve: { preserveSymlinks: false },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [dir, root, process.cwd()] } },
    logLevel: "warn",
  });
  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error("@smoove/renderer-browser: the bundle server did not bind a port.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => server.close(),
  };
}
```

- [ ] **Step 5: Add the `./harness` export**

In `packages/renderer-browser/package.json`, add to `exports`:

```json
    "./harness": {
      "types": "./dist/harness/index.d.ts",
      "import": "./dist/harness/index.js"
    }
```

- [ ] **Step 6: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/bundle.test.ts
```

Expected: PASS. `fs.allow` is the likely failure point; if Vite 403s on the entry, widen it
to include the workspace root.

- [ ] **Step 7: Checkpoint**

Report the passing output. Do not commit.

## Task 6: Harness — setup and seek

**Files:**
- Create: `packages/renderer-browser/src/harness/index.ts`

This code runs **in the page**. It may import `@smoove/core` and nothing Node-shaped.

- [ ] **Step 1: Implement `install`, `setup` and `seek`**

```ts
import type { Composition } from "@smoove/core";

/** What the driver calls into, via `page.evaluate`. */
export interface SmooveHarness {
  setup(opts: { width?: number; height?: number }): Promise<{
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
  }>;
  seek(frame: number): Promise<void>;
  audioClips(): unknown[];
}

declare global {
  interface Window {
    __smoove?: SmooveHarness;
  }
}

/** How long a single frame may wait on its assets before we call it stuck. */
const SEEK_TIMEOUT_MS = 30_000;

export function install(comp: Composition): void {
  window.__smoove = {
    async setup() {
      // Fonts must be in before frame 0, or the first frames render in a
      // fallback face and the render is silently wrong rather than late.
      await document.fonts.ready;
      return {
        width: comp.width(),
        height: comp.height(),
        fps: comp.fps,
        durationInFrames: comp.durationInFrames.get(),
      };
    },

    async seek(frame: number) {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          // The single thing that has historically made a stuck render
          // debuggable: say WHICH gate never cleared, not just that one didn't.
          const pending = pendingGateLabels(comp);
          reject(
            new Error(
              `[smoove] frame ${frame} timed out after ${SEEK_TIMEOUT_MS}ms waiting on ` +
                `${pending.length} unfinished asset gate(s): ${pending.join(", ") || "unlabelled"}`,
            ),
          );
        }, SEEK_TIMEOUT_MS);
      });
      await Promise.race([comp.renderFrame(frame), timeout]);
    },

    audioClips() {
      return [];
    },
  };
}

/** Best-effort read of outstanding delayRender handles for the timeout message. */
function pendingGateLabels(comp: Composition): string[] {
  const internal = comp as unknown as { _kmGates?: Map<unknown, string> };
  if (!internal._kmGates) return [];
  return [...internal._kmGates.values()];
}
```

- [ ] **Step 2: Check the real gate field name**

`_kmGates` above is an assumption. Read the `delayRender` / `continueRender` implementation
in `packages/core/src/engine/composition.ts` and correct `pendingGateLabels` to whatever the
handle store is actually called. If handles are unlabelled, say so in the message rather
than inventing labels.

```bash
grep -n "delayRender\|continueRender" packages/core/src/engine/composition.ts
```

- [ ] **Step 3: Build**

```bash
pnpm --filter @smoove/renderer-browser build
```

Expected: succeeds. `document` and `window` need the DOM lib; if tsc complains, add
`"lib": ["ES2022", "DOM"]` to the package tsconfig.

- [ ] **Step 4: Checkpoint**

Report the build output. Do not commit.

## Task 7: Harness — WebCodecs capture

**Files:**
- Modify: `packages/renderer-browser/src/harness/index.ts`
- Create: `packages/renderer-browser/src/harness/encode.ts`

- [ ] **Step 1: Implement the in-page encoder**

`packages/renderer-browser/src/harness/encode.ts`:

```ts
export interface SliceEncoderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  /** Called for every encoded chunk, in encode order. */
  onChunk(payload: {
    data: Uint8Array;
    type: "key" | "delta";
    timestamp: number;
    duration: number;
    description?: Uint8Array;
  }): void;
}

/**
 * One `VideoEncoder` per slice. Every slice opens on a keyframe so it decodes
 * standalone and the muxer can concatenate slices without re-encoding.
 */
export class SliceEncoder {
  private readonly encoder: VideoEncoder;
  private readonly opts: SliceEncoderOptions;
  private description: Uint8Array | undefined;

  constructor(opts: SliceEncoderOptions) {
    this.opts = opts;
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        const raw = meta?.decoderConfig?.description;
        if (raw && !this.description) this.description = new Uint8Array(raw as ArrayBuffer);
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        opts.onChunk({
          data,
          type: chunk.type,
          timestamp: chunk.timestamp / 1e6,
          duration: (chunk.duration ?? 1e6 / opts.fps) / 1e6,
          description: this.description,
        });
      },
      error: (err) => {
        throw err;
      },
    });
    this.encoder.configure({
      codec: opts.codec,
      width: opts.width,
      height: opts.height,
      bitrate: opts.bitrate,
      framerate: opts.fps,
      latencyMode: "quality",
    });
  }

  /** `indexInSlice === 0` forces the keyframe that makes the slice standalone. */
  async add(canvas: HTMLCanvasElement, indexInSlice: number, globalFrame: number): Promise<void> {
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((globalFrame / this.opts.fps) * 1e6),
      duration: Math.round(1e6 / this.opts.fps),
    });
    try {
      this.encoder.encode(frame, { keyFrame: indexInSlice === 0 });
    } finally {
      frame.close();
    }
    // Respect encoder backpressure, or a fast renderer buries it and the tab OOMs.
    if (this.encoder.encodeQueueSize > 8) {
      await new Promise<void>((r) => {
        const tick = () => (this.encoder.encodeQueueSize > 4 ? queueMicrotask(tick) : r());
        tick();
      });
    }
  }

  async finish(): Promise<void> {
    await this.encoder.flush();
    this.encoder.close();
  }
}

/** Is WebCodecs able to encode this config here? Decides the screenshot fallback. */
export async function canEncode(config: VideoEncoderConfig): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    return (await VideoEncoder.isConfigSupported(config)).supported === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Wire chunk transport into the harness**

Add to `install()` in `harness/index.ts` a `renderSlice` method. Chunks leave through a
binding the driver exposes as `window.__smooveChunk`, which puppeteer's
`page.exposeFunction` provides. Binding arguments must be JSON-serializable, so the byte
array goes as base64:

```ts
    async renderSlice(opts: {
      from: number;
      to: number;
      fps: number;
      bitrate: number;
      codec: string;
    }) {
      const canvas = comp.captureCanvas() as unknown as HTMLCanvasElement;
      const encoder = new SliceEncoder({
        width: comp.width(),
        height: comp.height(),
        fps: opts.fps,
        bitrate: opts.bitrate,
        codec: opts.codec,
        onChunk: (payload) => {
          window.__smooveChunk?.({
            ...payload,
            data: bytesToBase64(payload.data),
            description: payload.description ? bytesToBase64(payload.description) : undefined,
          });
        },
      });

      for (let frame = opts.from; frame <= opts.to; frame++) {
        await window.__smoove!.seek(frame);
        await encoder.add(comp.captureCanvas() as unknown as HTMLCanvasElement, frame - opts.from, frame);
        window.__smooveProgress?.(frame);
      }
      await encoder.finish();
      void canvas;
    },
```

with

```ts
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}
```

Three declaration updates go with this, all in `harness/index.ts`. Miss any of them and the
driver in Task 9 fails to typecheck against the harness:

```ts
export interface SmooveHarness {
  setup(opts: { width?: number; height?: number }): Promise<{
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
  }>;
  seek(frame: number): Promise<void>;
  audioClips(): unknown[];
  /** Added in Task 7. Renders [from, to] and streams chunks out through the bindings. */
  renderSlice(opts: {
    from: number;
    to: number;
    fps: number;
    bitrate: number;
    codec: string;
  }): Promise<void>;
}

declare global {
  interface Window {
    __smoove?: SmooveHarness;
    /** Installed by the driver via page.exposeFunction. */
    __smooveChunk?: (chunk: {
      data: string;
      type: "key" | "delta";
      timestamp: number;
      duration: number;
      description?: string;
    }) => void;
    __smooveProgress?: (frame: number) => void;
  }
}
```

- [ ] **Step 3: Build**

```bash
pnpm --filter @smoove/renderer-browser build
```

Expected: succeeds.

- [ ] **Step 4: Checkpoint**

Report the build output. Do not commit.

## Task 8: Muxer

**Files:**
- Create: `packages/renderer-browser/src/mux.ts`
- Test: `packages/renderer-browser/src/mux.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PacketMuxer } from "./mux.js";

it("writes a file with an mp4 signature from raw packets", async () => {
  const output = join(tmpdir(), `smoove-mux-${process.pid}.mp4`);
  const muxer = new PacketMuxer({
    output,
    width: 160,
    height: 90,
    fps: 30,
    format: "mp4",
    codec: "avc",
    hasAudio: false,
  });
  await muxer.start();
  // A single fabricated keyframe is enough to prove the wiring; decodability is
  // the parity test's job, not this one's.
  await muxer.addPacket({
    data: new Uint8Array([0, 0, 0, 1, 0x65, 0x88]),
    type: "key",
    timestamp: 0,
    duration: 1 / 30,
    description: new Uint8Array([1, 66, 0, 31, 255]),
  });
  await muxer.finalize();

  const bytes = await readFile(output);
  expect(bytes.length).toBeGreaterThan(0);
  expect(bytes.subarray(4, 8).toString("latin1")).toBe("ftyp");
  await rm(output, { force: true });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/mux.test.ts
```

Expected: FAIL, cannot resolve `./mux.js`.

- [ ] **Step 3: Implement**

`packages/renderer-browser/src/mux.ts`:

```ts
import {
  EncodedPacket,
  EncodedVideoPacketSource,
  FilePathTarget,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from "mediabunny";

export interface PacketMuxerOptions {
  output: string;
  width: number;
  height: number;
  fps: number;
  format: "mp4" | "webm";
  codec: "avc" | "vp9";
  hasAudio: boolean;
}

export interface IncomingPacket {
  data: Uint8Array;
  type: "key" | "delta";
  /** Presentation timestamp in seconds, already on the global timeline. */
  timestamp: number;
  duration: number;
  description?: Uint8Array;
}

/**
 * Muxes already-encoded packets. The browser did the encoding, so nothing here
 * touches pixels: this only orders packets and writes the container, using the
 * same mediabunny Output the skia backend uses.
 */
export class PacketMuxer {
  private readonly output: Output;
  private readonly video: EncodedVideoPacketSource;
  private readonly opts: PacketMuxerOptions;
  private first = true;
  private sequence = 0;

  constructor(opts: PacketMuxerOptions) {
    this.opts = opts;
    this.output = new Output({
      format:
        opts.format === "webm"
          ? new WebMOutputFormat()
          : new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new FilePathTarget(opts.output),
    });
    this.video = new EncodedVideoPacketSource(opts.codec);
    this.output.addVideoTrack(this.video, { frameRate: opts.fps });
  }

  start(): Promise<void> {
    return this.output.start();
  }

  /**
   * Packets must arrive in decode order. The driver is responsible for feeding
   * slices in timeline order; this only carries the decoder config, which
   * mediabunny takes from the first call and ignores thereafter.
   */
  async addPacket(packet: IncomingPacket): Promise<void> {
    const encoded = new EncodedPacket(
      packet.data,
      packet.type,
      packet.timestamp,
      packet.duration,
      this.sequence++,
    );
    if (this.first) {
      this.first = false;
      await this.video.add(encoded, {
        decoderConfig: {
          codec: this.opts.codec === "avc" ? "avc1.42001f" : "vp09.00.10.08",
          codedWidth: this.opts.width,
          codedHeight: this.opts.height,
          description: packet.description,
        },
      });
      return;
    }
    await this.video.add(encoded);
  }

  finalize(): Promise<void> {
    return this.output.finalize();
  }

  cancel(): Promise<void> {
    return this.output.cancel();
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/mux.test.ts
```

Expected: PASS. If mediabunny rejects the fabricated packet, replace the fixture with bytes
captured from the Task 2 spike rather than loosening the assertion.

- [ ] **Step 5: Checkpoint**

Report the passing output. Do not commit.

## Task 9: Driver — serial end to end

Get one page rendering the whole timeline correctly before adding slices. A parallel bug and
a correctness bug look identical from the outside, so do not have both at once.

**Files:**
- Create: `packages/renderer-browser/src/driver.ts`
- Modify: `packages/renderer-browser/src/index.ts`
- Test: `packages/renderer-browser/src/render.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { bundleComposition, renderCompositionInBrowser } from "./index.js";

it("renders a composition to a non-empty mp4", async () => {
  const dir = await mkdtemp(join(tmpdir(), "smoove-render-"));
  const entry = join(dir, "composition.ts");
  await writeFile(
    entry,
    `import { Composition, Sequence, Text } from "@smoove/core";
     const comp = new Composition({ id: "t", width: 320, height: 180, fps: 30, durationInFrames: 30 });
     const seq = new Sequence({ from: 0, durationInFrames: 30 });
     seq.add(new Text({ x: 20, y: 60, text: "hello", fontSize: 40, fill: "white" }));
     comp.add(seq);
     export default comp;`,
  );

  const bundle = await bundleComposition({ entry });
  const output = join(dir, "out.mp4");
  try {
    const result = await renderCompositionInBrowser({
      bundle,
      output,
      concurrency: 1,
      mute: true,
    });
    expect(result.frames).toBe(30);
    expect((await stat(output)).size).toBeGreaterThan(1000);
  } finally {
    await bundle.close();
  }
}, 180_000);
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/render.test.ts
```

Expected: FAIL, `renderCompositionInBrowser` is not exported.

- [ ] **Step 3: Write the bitrate mapping**

WebCodecs takes a plain bits-per-second number, while mediabunny's quality constants are
resolution-aware objects. That conversion is real logic, so it gets its own function and its
own test rather than a magic number inlined in the driver.

`packages/renderer-browser/src/bitrate.ts`:

```ts
import type { QualityPreset } from "@smoove/renderer";

/** Bits per second per pixel per frame, chosen to land near the skia backend's
 *  output size at 1080p30. Calibrate against a real render before trusting it. */
const BPP: Record<QualityPreset, number> = {
  low: 0.04,
  medium: 0.08,
  high: 0.14,
  max: 0.24,
};

/** Target video bitrate for a WebCodecs `VideoEncoder`. */
export function bitrateFor(
  preset: QualityPreset,
  width: number,
  height: number,
  fps: number,
): number {
  return Math.round(width * height * fps * (BPP[preset] ?? BPP.medium));
}
```

`packages/renderer-browser/src/bitrate.test.ts`:

```ts
import { expect, it } from "vitest";
import { bitrateFor } from "./bitrate.js";

it("scales with pixel count and frame rate", () => {
  const base = bitrateFor("medium", 1920, 1080, 30);
  expect(bitrateFor("medium", 1920, 1080, 60)).toBe(base * 2);
  expect(bitrateFor("medium", 960, 540, 30)).toBe(base / 4);
});

it("orders the presets", () => {
  const at = (p: Parameters<typeof bitrateFor>[0]) => bitrateFor(p, 1280, 720, 30);
  expect(at("low")).toBeLessThan(at("medium"));
  expect(at("medium")).toBeLessThan(at("high"));
  expect(at("high")).toBeLessThan(at("max"));
});
```

- [ ] **Step 4: Implement the driver, single page only**

`packages/renderer-browser/src/driver.ts`:

```ts
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { QUALITY_PRESETS, type QualityPreset } from "@smoove/renderer";
import { bitrateFor } from "./bitrate.js";
import { resolveChromePath } from "./chrome.js";
import { type IncomingPacket, PacketMuxer } from "./mux.js";
import type { BrowserRenderOptions, RenderResult } from "./types.js";

/** Wire format of a chunk crossing the page boundary. Bytes travel as base64
 *  because puppeteer's exposed functions carry JSON, not binary. */
interface WireChunk {
  data: string;
  type: "key" | "delta";
  timestamp: number;
  duration: number;
  description?: string;
}

interface CompInfo {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

/**
 * Launch Chrome and render a bundled composition.
 *
 * Serial: one page walks the whole timeline. Task 10 adds slices on top of this
 * shape, so the ordering contract lives here: packets reach the muxer in decode
 * order, and the muxer is awaited so encoder backpressure reaches the page.
 */
export async function renderCompositionInBrowser(
  opts: BrowserRenderOptions,
): Promise<RenderResult> {
  const browser = await puppeteer.launch({
    executablePath: resolveChromePath({ executablePath: opts.executablePath }),
    headless: true,
    args: ["--no-sandbox", "--enable-gpu", "--use-angle=default", "--autoplay-policy=no-user-gesture-required"],
  });

  let muxer: PacketMuxer | undefined;
  try {
    const page = await browser.newPage();
    const info = await openHarness(page, opts.bundle.url);

    const fps = opts.fps ?? info.fps;
    const from = opts.range?.from ?? 0;
    const to = opts.range?.to ?? info.durationInFrames - 1;
    const frameCount = to - from + 1;
    const preset: QualityPreset =
      typeof opts.quality === "string" ? opts.quality : "medium";
    void QUALITY_PRESETS;

    muxer = new PacketMuxer({
      output: opts.output,
      width: info.width,
      height: info.height,
      fps,
      format: opts.format ?? "mp4",
      codec: (opts.format ?? "mp4") === "webm" ? "vp9" : "avc",
      hasAudio: false,
    });
    await muxer.start();

    // Packets are muxed as they arrive. The queue keeps addPacket awaited one at
    // a time: EncodedVideoPacketSource.add resolves on writer backpressure, and
    // overlapping adds would reorder packets, which invalidates the file.
    let chain: Promise<void> = Promise.resolve();
    let muxError: Error | undefined;
    let encoded = 0;
    const startMs = Date.now();

    await page.exposeFunction("__smooveChunk", (chunk: WireChunk) => {
      chain = chain.then(async () => {
        if (muxError) return;
        const packet: IncomingPacket = {
          data: fromBase64(chunk.data),
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration,
          description: chunk.description ? fromBase64(chunk.description) : undefined,
        };
        try {
          await muxer!.addPacket(packet);
        } catch (err) {
          muxError = err instanceof Error ? err : new Error(String(err));
        }
      });
    });

    await page.exposeFunction("__smooveProgress", () => {
      encoded++;
      if (!opts.onProgress) return;
      const elapsed = (Date.now() - startMs) / 1000;
      const rate = elapsed > 0 ? encoded / elapsed : 0;
      opts.onProgress({
        frame: encoded,
        total: frameCount,
        fps: rate,
        etaSeconds: rate > 0 ? (frameCount - encoded) / rate : undefined,
      });
    });

    if (opts.signal?.aborted) throw new Error("[smoove] render aborted");
    opts.signal?.addEventListener("abort", () => void browser.close(), { once: true });

    await page.evaluate(
      (o) => window.__smoove!.renderSlice(o),
      {
        from,
        to,
        fps,
        bitrate: bitrateFor(preset, info.width, info.height, fps),
        codec: (opts.format ?? "mp4") === "webm" ? "vp09.00.10.08" : "avc1.42001f",
      },
    );

    await chain;
    if (muxError) throw muxError;
    await muxer.finalize();
    muxer = undefined;

    return {
      output: opts.output,
      width: info.width,
      height: info.height,
      frames: frameCount,
      durationInSeconds: frameCount / fps,
      hasAudio: false,
    };
  } catch (err) {
    await muxer?.cancel().catch(() => {});
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Navigate, wait for the harness to install, and read the composition's shape. */
async function openHarness(page: Page, url: string): Promise<CompInfo> {
  page.on("pageerror", (err) => {
    // A composition module that throws otherwise shows up as a seek timeout
    // thirty seconds later, which is a miserable way to learn about a typo.
    console.error("[smoove] page error:", err.message);
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction("!!window.__smoove");
  return page.evaluate(() => window.__smoove!.setup({})) as Promise<CompInfo>;
}

export type { Browser };
```

Two notes for whoever implements this. `exposeFunction` must run before the page calls the
binding, which it does here because `renderSlice` is only invoked afterwards. And `hasAudio`
is hard-coded false until Task 12 wires audio in; leave it, rather than half-implementing it
now.

- [ ] **Step 5: Export from the barrel**

```ts
export { bundleComposition } from "./bundle.js";
export { renderCompositionInBrowser } from "./driver.js";
export { resolveChromePath } from "./chrome.js";
export type {
  Bundle,
  BundleOptions,
  BrowserRenderOptions,
  RenderOptions,
  RenderProgress,
  RenderResult,
} from "./types.js";
```

- [ ] **Step 6: Run the tests and confirm they pass**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/bitrate.test.ts src/render.test.ts
```

Expected: PASS, producing an mp4 over 1 KB.

- [ ] **Step 7: Watch the output**

```bash
open /tmp/smoove-render-*/out.mp4
```

Confirm it plays and shows white "hello" on black for one second. A file with a valid header
and garbage pixels passes Step 5; only your eyes catch that.

- [ ] **Step 8: Checkpoint**

Report the passing output and confirm you watched the file. Do not commit.

## Task 10: Parallel slices

Only start this once Task 9 is green and Task 2 answered `identical: true`.

**Files:**
- Modify: `packages/renderer-browser/src/driver.ts`
- Modify: `packages/renderer-browser/src/render.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `render.test.ts`:

```ts
it("renders identical output whether sliced or serial", async () => {
  const dir = await mkdtemp(join(tmpdir(), "smoove-parallel-"));
  const entry = join(dir, "composition.ts");
  await writeFile(
    entry,
    `import { Composition, Sequence, Text } from "@smoove/core";
     import { interpolate } from "@smoove/core";
     const comp = new Composition({ id: "t", width: 320, height: 180, fps: 30, durationInFrames: 60 });
     const seq = new Sequence({ from: 0, durationInFrames: 60 });
     const t = new Text({ x: 20, y: 60, text: "move", fontSize: 40, fill: "white" });
     seq.add(t);
     seq.onFrame((f) => { t.x(interpolate(f, [0, 59], [0, 200])); });
     comp.add(seq);
     export default comp;`,
  );

  const bundle = await bundleComposition({ entry });
  try {
    const serial = join(dir, "serial.mp4");
    const sliced = join(dir, "sliced.mp4");
    const a = await renderCompositionInBrowser({ bundle, output: serial, concurrency: 1, mute: true });
    const b = await renderCompositionInBrowser({ bundle, output: sliced, concurrency: 4, mute: true });
    expect(b.frames).toBe(a.frames);
    // Sizes will differ slightly: four slices means four keyframes, not one.
    const sa = (await stat(serial)).size;
    const sb = (await stat(sliced)).size;
    expect(sb).toBeGreaterThan(sa * 0.5);
    expect(sb).toBeLessThan(sa * 3);
  } finally {
    await bundle.close();
  }
}, 300_000);
```

Check the real `onFrame` API name in `packages/core/src/engine/sequence.ts` before running;
correct the fixture if it differs.

- [ ] **Step 2: Run it and confirm it fails**

Expected: FAIL, because `concurrency` is currently ignored.

- [ ] **Step 3: Implement slicing**

- Slice count `n = opts.concurrency ?? Math.min(Math.max(1, cpus().length - 1), 4)`.
- Split `[from, to]` into `n` contiguous ranges, remainder onto the earliest slices.
- Open `n` pages on the one browser, each with its own exposed-function pair scoped to that
  page, each with its own chunk buffer.
- Run all slices concurrently, then feed the muxer **slice by slice in timeline order**, not
  in completion order. Packets must reach the muxer in decode order or the file is invalid.
- Buffer bound: if a slice's buffered chunks exceed a cap (start at 240), pause that page's
  rendering until the muxer drains. Without this, four pages at 1080p can hold the whole
  render in memory.
- Progress: sum the per-slice counters into one `RenderProgress`, so `frame` is monotonic
  even though slices finish out of order.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/render.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Watch the sliced output**

```bash
open /tmp/smoove-parallel-*/sliced.mp4
```

The text must move smoothly across the full two seconds with no stutter, freeze, or colour
break at the slice boundaries (frames 15, 30, 45). A boundary artifact here means the
SPS/PPS assumption from Task 2 does not hold in practice; stop and report.

- [ ] **Step 6: Checkpoint**

Report both results and confirm you watched the sliced file. Do not commit.

## Task 11: Screenshot fallback

**Files:**
- Modify: `packages/renderer-browser/src/harness/index.ts`
- Modify: `packages/renderer-browser/src/driver.ts`
- Modify: `packages/renderer-browser/src/render.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
it("still renders when WebCodecs encoding is unavailable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "smoove-fallback-"));
  const entry = join(dir, "composition.ts");
  await writeFile(
    entry,
    `import { Composition, Sequence, Text } from "@smoove/core";
     const comp = new Composition({ id: "t", width: 160, height: 90, fps: 30, durationInFrames: 15 });
     const seq = new Sequence({ from: 0, durationInFrames: 15 });
     seq.add(new Text({ x: 10, y: 40, text: "fb", fontSize: 24, fill: "white" }));
     comp.add(seq);
     export default comp;`,
  );

  const bundle = await bundleComposition({ entry });
  const output = join(dir, "fallback.mp4");
  try {
    const result = await renderCompositionInBrowser({
      bundle,
      output,
      concurrency: 1,
      mute: true,
      // Test-only switch that makes canEncode() report false.
      forceScreenshotFallback: true,
    });
    expect(result.frames).toBe(15);
    expect((await stat(output)).size).toBeGreaterThan(500);
  } finally {
    await bundle.close();
  }
}, 180_000);
```

- [ ] **Step 2: Run it and confirm it fails**

Expected: FAIL, `forceScreenshotFallback` is not a known option.

- [ ] **Step 3: Implement the fallback**

- Add `forceScreenshotFallback?: boolean` to `BrowserRenderOptions`, documented as being for
  tests and for Chromium builds with no H.264 encoder.
- In the harness, when `canEncode()` is false (or the flag is set), `renderSlice` returns
  raw frames instead: `canvas.toDataURL("image/png")` per frame, handed to
  `window.__smooveFrame`. Add that binding to the `Window` declaration alongside
  `__smooveChunk`:

```ts
    __smooveFrame?: (frame: { index: number; dataUrl: string }) => void;
```
- In the driver, when in fallback mode, decode each PNG and feed the **existing**
  `MediabunnyEncoder` from `@smoove/renderer` rather than `PacketMuxer`. That path already
  works and is already tested; do not write a second one.
- Log one line, once, saying the render fell back and why. Silent degradation is how a
  10x-slower render gets shipped without anyone noticing.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @smoove/renderer-browser exec vitest run src/render.test.ts
```

Expected: all three tests pass.

- [ ] **Step 5: Checkpoint**

Report the results. Do not commit.

## Task 12: Audio

**Files:**
- Modify: `packages/renderer-browser/src/harness/index.ts`
- Modify: `packages/renderer-browser/src/driver.ts`
- Modify: `packages/renderer/src/index.ts` (export `collectAudioTrack`, `mixAudio` if not already)

- [ ] **Step 1: Check what the renderer already exports**

```bash
grep -n "export" packages/renderer/src/index.ts
```

`collectAudioTrack(comp, fps)` returns `AudioClip[]`, which is plain serializable data
(`packages/renderer/src/types.ts:139-152`). That is the whole reason audio can stay
Node-side: the page reports the clip list, Node does the decoding and mixing with the code
that already ships.

- [ ] **Step 2: Implement `audioClips()` in the harness**

Replace the `return []` stub from Task 6 with a real call to `collectAudioTrack(comp, fps)`.
If that function currently lives somewhere Node-only, move it to `@smoove/core` (it touches
no Node API, only the node tree) and re-export it from `@smoove/renderer` so neither
backend's import changes.

- [ ] **Step 3: Wire it into the driver**

After `setup()` and before rendering, when `!opts.mute`:

```ts
const clips = (await page.evaluate(() => window.__smoove!.audioClips())) as AudioClip[];
```

Then reuse `mixAudio(clips, fps, durationInSeconds, from)` and the muxer's audio track,
exactly as `packages/renderer/src/render.ts:154-160` does.

Clip `src` values are bundle-relative URLs. Resolve them against `bundle.url` so Node fetches
them from the same origin the page loaded them from.

- [ ] **Step 4: Test with a composition that has audio**

Write a fixture using an audio file already in the repo:

```bash
ls packages/kitchen-sink/src/files
```

Assert `result.hasAudio === true` and that the output is materially larger than the same
render with `mute: true`.

- [ ] **Step 5: Run and confirm it passes**

```bash
pnpm --filter @smoove/renderer-browser test
```

- [ ] **Step 6: Checkpoint**

Report the results. Do not commit.

## Task 13: Parity test

**Files:**
- Create: `packages/renderer-browser/src/parity.test.ts`

- [ ] **Step 1: Write the test**

Skia and Chrome will not agree pixel for pixel, so equality is the wrong assertion. Two
measures are needed: a mean absolute difference (catches drift) and a worst-block difference
(catches a missing or misplaced node, which a whole-frame mean would average away).

`packages/renderer-browser/src/parity.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "@smoove/renderer/register";
import { renderStill } from "@smoove/renderer";
import { expect, it } from "vitest";
import { bundleComposition, renderStillInBrowser } from "./index.js";

const WIDTH = 320;
const HEIGHT = 180;
const BLOCK = 16;

/** Measured on first calibration; see Step 2 before changing either. */
const MAX_MEAN_DIFF = 6;
const MAX_BLOCK_DIFF = 40;

const FIXTURE = `import { Block, Composition, Sequence, Text } from "@smoove/core";
const comp = new Composition({ id: "parity", width: ${WIDTH}, height: ${HEIGHT}, fps: 30, durationInFrames: 30 });
const seq = new Sequence({ from: 0, durationInFrames: 30 });
seq.add(new Block({ x: 0, y: 0, width: ${WIDTH}, height: ${HEIGHT}, background: "#101020" }));
seq.add(new Text({ x: 40, y: 70, text: "parity", fontSize: 36, fill: "#ffffff" }));
comp.add(seq);
export default comp;`;

function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs((a[i] as number) - (b[i] as number));
  return total / a.length;
}

/** Worst BLOCK x BLOCK tile. A missing node is local, so it hides in a global mean. */
function worstBlockDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let worst = 0;
  for (let by = 0; by < HEIGHT; by += BLOCK) {
    for (let bx = 0; bx < WIDTH; bx += BLOCK) {
      let total = 0;
      let n = 0;
      for (let y = by; y < Math.min(by + BLOCK, HEIGHT); y++) {
        for (let x = bx; x < Math.min(bx + BLOCK, WIDTH); x++) {
          const i = (y * WIDTH + x) * 4;
          for (let c = 0; c < 3; c++) {
            total += Math.abs((a[i + c] as number) - (b[i + c] as number));
            n++;
          }
        }
      }
      worst = Math.max(worst, total / n);
    }
  }
  return worst;
}

it.each([0, 15, 29])("frame %i matches the skia backend", async (frame) => {
  const dir = await mkdtemp(join(tmpdir(), "smoove-parity-"));
  const entry = join(dir, "composition.ts");
  await writeFile(entry, FIXTURE);

  const skia = await pixelsFromSkia(entry, frame);
  const bundle = await bundleComposition({ entry });
  try {
    const chrome = await renderStillInBrowser({ bundle, frame });
    const mean = meanAbsDiff(skia, chrome);
    const block = worstBlockDiff(skia, chrome);
    expect(mean, `mean abs diff ${mean.toFixed(2)}`).toBeLessThan(MAX_MEAN_DIFF);
    expect(block, `worst 16x16 block diff ${block.toFixed(2)}`).toBeLessThan(MAX_BLOCK_DIFF);
  } finally {
    await bundle.close();
  }
}, 180_000);
```

`pixelsFromSkia` loads the fixture through the Node backend and returns RGBA. Build it on
`renderStill` plus a PNG decode, or read the canvas directly the way
`packages/renderer/src/effects-determinism.test.ts:37-42` does, whichever is less code.

`renderStillInBrowser({ bundle, frame })` does not exist yet: add it to the driver as a thin
wrapper that opens a page, seeks one frame, and returns `getImageData` bytes rather than
encoded packets. Export it from the barrel.

- [ ] **Step 2: Calibrate the threshold**

Run it once with the assertion printing the measured values rather than asserting, and pick a
threshold with clear headroom. Record the measured numbers in a comment, the way Task 1's
constants are recorded. Do not pick a round number and hope.

- [ ] **Step 3: Verify it catches a real divergence**

Temporarily change the browser fixture's fill from white to `#eeeeee` and confirm the test
fails. Then revert. A parity test that has never seen a divergence proves nothing, which is
the same lesson as Task 1 Step 3.

- [ ] **Step 4: Checkpoint**

Report the calibrated numbers and both directions. Do not commit.

## Task 14: Documentation and changeset

**Files:**
- Modify: `AGENTS.md` (the Layout section)
- Modify: `doc/README.md`
- Create: `.changeset/<name>.md`

- [ ] **Step 1: Load the writing skill**

All user-facing smoove prose goes through it, and a changeset becomes the published
changelog:

```
Skill(smoove-writing)
```

- [ ] **Step 2: Add the package to `AGENTS.md`**

One entry in the Layout block, in the same voice and shape as the `packages/renderer` line
directly above it.

- [ ] **Step 3: Document the API in `doc/README.md`**

Repo convention: public API changes update `doc/README.md` so its example stays accurate.
Show `bundleComposition` plus `renderCompositionInBrowser`, and state plainly that the
browser path needs a Chrome on the machine and that the Node path is unchanged.

- [ ] **Step 4: Write the changeset**

`@smoove/renderer-browser` at `patch` (pre-1.0 convention: minor means breaking, additive
features are patch).

- [ ] **Step 5: Self-check the prose**

```bash
grep -n "—\|–" .changeset/<name>.md doc/README.md AGENTS.md
```

Expected: no em or en dashes in anything you added. Also confirm no other framework is named
and every number you wrote is one you measured.

- [ ] **Step 6: Flag the release chore**

A new publishable package needs a one-time trusted-publisher registration on npmjs.com
(`RELEASING.md`). That is the maintainer's to do, so call it out explicitly in the handoff
rather than attempting it.

- [ ] **Step 7: Final checkpoint**

```bash
pnpm build && pnpm check && pnpm --filter @smoove/renderer-browser test
```

Expected: all green. Report the full working-tree status. Do not commit.

---

## Notes carried from the spec

- **Frame purity is the load-bearing assumption.** `setFrame(n)` fully determines the image
  with no dependence on frame `n-1`. That is the only reason slices may render out of order.
  If a composition ever violates it, sliced renders break in ways serial ones do not, so any
  bug that appears only at `concurrency > 1` should be checked against this first.
- **The browser backend is not automatically faster.** It wins big on a machine with a GPU
  (hardware encode and decode) and is roughly neutral in a GPU-less container, where Chrome
  falls back to SwiftShader and software codecs. Its reliable win everywhere is parity with
  preview. Do not write docs claiming a speedup that has not been measured on the target
  machine.
- **Out of scope, deliberately:** multi-process frame segments in the Node renderer, video
  decode throughput work, and the phase 4 blur pyramid.
