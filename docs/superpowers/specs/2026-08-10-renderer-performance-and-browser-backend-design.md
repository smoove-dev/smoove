# Renderer performance and a browser rendering backend

Date: 2026-08-10
Status: approved, not yet implemented

## Problem

Full-quality exports through the studio render queue crawl, and get worse the
longer they run. The symptom was reported as "gets stuck", specifically when the
composition uses GL (shader effects or Tier B transitions).

## Measurement

Profiled before designing, with a harness that reports per-frame cost *growth*
rather than an average, because an average hides this class of bug completely.

`flame-wrap` (1280x720, shader effect), 400 frames:

| | first 20 frames | last 20 frames | RSS | wall |
| --- | --- | --- | --- | --- |
| before | 19.5 ms/frame | 160.5 ms/frame | 310 -> 1725 MB | 27.7 s |
| after | 19.5 ms/frame | 16.8 ms/frame | 307 MB flat | 7.1 s |

Growth was 8.6x over 400 frames and linear in frame index, so a 1200-frame
export degrades roughly 25x. That is the reported symptom.

What it was not, all ruled out by measurement:

- **GL object leak.** Counts were flat: 1 texture, 1 program, 1 buffer total,
  and a constant 20 `texImage2D` / 20 `readPixels` per frame.
- **JS heap leak.** V8 heap sat at 55 MB for the whole run.
- **Effects canvas pool churn.** The work-canvas pool held exactly 1 entry
  throughout.
- **Anything in the core render or capture path.** A non-GL control
  composition (`flex-showcase`) ran dead flat at 10 ms/frame with pinned RSS.

What it was: `packages/renderer/src/gl-node.ts`, the `result()` readback. `out`
is a long-lived skia `Canvas`, and every shader readback did `createImageData` +
`putImageData` into it. skia-canvas records draw commands forever, `putImageData`
appends to that recording, and every subsequent pixel read replays the entire
history. At ~20 readbacks per frame the replay cost grows without bound.

This is the same failure mode as S0 in `doc/effects-performance-research.md`. That
round fixed the layer canvases, the `captureCanvas` scratch, and the pooled
effect surfaces, but missed this one, which is why the regression only showed on
the GL path.

## Track 1 — the existing Node renderer

### 1.1 The fix

`ctx.reset()` on the readback canvas before writing the frame's pixels, in
`gl-node.ts`. One line, already applied and built.

### 1.2 Growth regression harness

A Vitest test in `@smoove/renderer` that renders ~120 frames of a
shader-effect composition and asserts:

```
mean(last quartile) / mean(first quartile) < 1.3
```

The assertion is on **growth ratio only**, never on absolute milliseconds, so it
stays stable across machines and CI runners. It builds on the skia+gl test rig
already present in `packages/renderer/src/effects*.test.ts`.

The two profiler scripts written during this investigation
(`packages/kitchen-sink/scripts/profile-render.mjs` and `profile-bootstrap.ts`)
are kept as the manual deep-dive tool for when the test trips. They report
per-frame timing buckets, RSS, and GL object churn.

### 1.3 Explicitly out of scope

Considered and deliberately not included **in the Node renderer**: multi-process
frame segments, video decode throughput work, and the phase 4 blur pyramid. The
leak was the reported problem; these are separate efforts to be scoped on their
own evidence. (Track 2 does render in parallel, but it gets that far more cheaply
— parallel pages in one browser, with no process or GL context isolation
problems to solve.)

## Track 2 — `@smoove/renderer-browser`

A **second backend**, not a replacement. `@smoove/renderer` keeps the skia path
unchanged; the browser backend sits alongside it and the caller picks.

### 2.1 Why a separate package

Chromium must never land in `@smoove/renderer`'s install graph. Renders have to
run on a local Mac, in a GPU-less Coolify container, and on users' machines and
CI, and a mandatory 400 MB download would be unacceptable in the last of those.

Per repo convention the new package is added to the `fixed` group in
`.changeset/config.json`, and needs a one-time trusted-publisher registration on
npmjs.com (maintainer task, to be flagged in the PR).

### 2.2 What it buys, honestly

On a machine with a GPU it is a large win: hardware H.264 encode, hardware video
decode (which removes the ~250 ms/frame software decode measured on
`snoove-showcase`), and real GPU rasterization for GL.

In a GPU-less container it is roughly neutral. Chrome falls back to SwiftShader
for GL and to software codecs, which is comparable to headless-gl and node-av.

Its durable win in every environment is **parity**: preview and export run the
identical runtime, so fonts, filters, and shader precision cannot diverge between
what the user sees and what they export.

### 2.3 Browser acquisition

`puppeteer-core` plus a resolver, in this order:

1. `SMOOVE_CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH`
2. A system Chrome, Edge, or Chromium at the platform's known locations
3. An explicit opt-in download via `@puppeteer/browsers` into a cache dir

Never an implicit download at install time. If no browser resolves, the error
names all three options.

### 2.4 Public API

The Node backend takes a live `Composition`. The browser backend cannot, because
the composition is constructed inside the page. The API states that asymmetry
rather than papering over it:

```ts
const bundle = await bundleComposition({ entry: "./src/composition.ts" });
await renderCompositionInBrowser({ bundle, output: "out.mp4", ...RenderOptions });
```

`RenderOptions`, `RenderResult`, and `RenderProgress` are re-exported unchanged
from `@smoove/renderer`, so a caller such as the studio render queue switches
backends at a single call site.

### 2.5 Architecture

Four units with separate responsibilities, each testable on its own.

**Bundler** (`bundle.ts`). Vite programmatic build of a generated entry that
imports the user's composition module plus the harness, with `@smoove/vite`'s
smoove plugin handling media and font URL rewriting. Serves the output from a
local static server. Returns `{ url, close() }`.

Depends on: vite, `@smoove/vite`. Used by: the driver, or directly by a caller
that wants to build once and render many times.

**Harness** (in-page). Three entry points on `window`:

- `setup({ id, props })` builds the composition and waits for
  `document.fonts.ready`.
- `seek(frame)` runs `comp.renderFrame(frame)` and resolves only once every
  `delayRender` gate has cleared. On timeout it rejects with the labels of the
  gates still outstanding, which is the single thing that made stuck renders
  debuggable in past sessions.
- `audioClips()` returns the serialized audio track (see 2.7).

Capture is `new VideoFrame(canvas)` fed to a `VideoEncoder`, falling back to
`canvas.toBlob("image/png")` when `VideoEncoder.isConfigSupported()` rejects the
config, which is the case for open-source Chromium builds without H.264. Encoded
chunks leave the page through a CDP binding.

Depends on: `@smoove/core` only. Knows nothing about Node, files, or muxing.

**Driver** (`driver.ts`). Launches Chrome, opens N pages, assigns each a
contiguous frame slice, aggregates progress into a single `RenderProgress`
stream, honors `AbortSignal`, and bounds in-flight chunks per page so a fast
renderer cannot outrun the muxer into an OOM.

**Muxer** (`mux.ts`). Feeds slices into mediabunny's `EncodedVideoPacketSource`,
rewrites packet timestamps onto the global timeline
(`ts = (sliceStart + i) / fps`), and muxes through the existing mediabunny
`Output`. Container selection, quality presets, and the audio track are today's
code unchanged.

### 2.6 Parallel slicing

Compositions are frame-pure: `setFrame(n)` fully determines the image, with no
dependence on frame `n-1`. That property is what makes independent slices legal,
and every part of this design rests on it.

`[from, to]` is split into N contiguous slices, N = `concurrency ?? min(cores - 1, 4)`.
Each slice forces a keyframe on its first frame (`encode(frame, { keyFrame: true })`),
so slices are independently decodable and concatenate at the packet level with no
re-encode.

**Top technical risk.** Concatenating H.264 packets from separate `VideoEncoder`
instances requires byte-identical SPS/PPS across those instances. All pages use
one config, so this should hold, but it must be verified by a standalone spike
**before** any surrounding machinery is built. If it does not hold, the fallback
is a single encoder fed by parallel renderers, which keeps most of the speedup at
the cost of one serialization point.

### 2.7 Audio

Audio stays entirely Node-side. `collectAudioTrack` already returns plain
serializable data (`AudioClip[]`: id, src, frame range, media in-point, playback
rate, volume), so the harness runs it in-page and ships the result out, and
Node's existing `mixAudio` decodes the sources and produces the same PCM it does
today. No Node-side `Composition` is required and the mixing code is shared
rather than forked.

Clip `src` values are bundle-relative URLs. Node fetches them from the same local
origin the bundler serves.

### 2.8 Verification

- **Parity test.** Render one composition through both backends at low
  resolution and compare sampled frames. Skia and Chrome will not agree to the
  pixel, so the assertion is "no structural divergence", not equality: mean
  absolute per-channel difference under a threshold calibrated from a first run,
  plus a check that no contiguous region exceeds it (which is what catches a
  missing node or a mispositioned layer, as opposed to antialiasing noise).
- **Growth test** (1.2) applies to both backends.
- **Fallback path test.** Force the screenshot path and confirm it produces a
  valid file, so the fallback cannot rot unnoticed.

## Documentation

`AGENTS.md`'s layout section gains the new package. `doc/README.md` gains the
browser backend's API. A changeset is required. All user-facing prose for this
(package description, README, docs pages) goes through the `smoove-writing`
skill.

## Implementation order

1. Track 1: the fix (done) plus the growth regression test.
2. The SPS/PPS concatenation spike (2.6), standalone, before anything else in
   track 2.
3. Package scaffold, bundler, harness, serial single-page render end to end.
4. Parallel slicing and the driver.
5. Screenshot fallback path.
6. Parity and fallback tests, docs, changeset.
