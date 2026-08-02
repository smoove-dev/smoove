# @smoove/lottie — design

Date: 2026-07-27
Branch: `shemi/smoove-lottie`
Status: proposed

## Goal

A new package, `@smoove/lottie`, exposing a `Lottie` node that plays After
Effects / Lottie animations on smoove's clock: the composition's frame and fps
drive the animation, not a wall clock. Same node works in browser preview and
in headless `@smoove/renderer` mp4 output, with identical pixels.

## Why this is not just "drop in a lottie player"

smoove needs a pure function from frame number to pixels: callable in Node with
no DOM, seekable in any order, deterministic on re-seek, and stable over
thousands of frames.

`lottie-web` (the reference player, pure JS, no WASM) was the obvious
alternative and was tested head-to-head rather than assumed away. **It cleared
every correctness bar.** It imports in Node without throwing, and with a ~40
line `document` shim backed by skia-canvas it renders masks, track mattes and
gradient fills correctly, `goToAndStop(frame, true)` is deterministic on
re-seek, and fractional frames interpolate. Against the same fixture its output
matched dotlottie to a **mean absolute difference of 0.2 per byte** — visually
indistinguishable.

It was rejected on one measured property: **under skia-canvas it degrades
linearly and without bound.** Rendering the same 40-frame loop repeatedly at
1080p, with `ctx.reset()` every frame:

```
lottie-web  18.2 → 35.9 → 58.2 → 74.7 → 93.3 → 115.6 → 129.6 → 152.1 ms/frame
dotlottie    8.9 →  8.8 →  8.8 →  8.9 →  8.9 →   8.8 →   8.9 →   8.8 ms/frame
```

By frame 320 lottie-web is 17× slower than it started and still climbing; a
900-frame render would be unusable. The likely mechanism is the internal
canvases lottie-web allocates for masks and mattes: under skia those are native
memory V8's GC cannot see, which is the same class of problem the effects work
already hit. It may well be fixable by pooling canvases in the shim — but that
means owning a DOM shim *and* debugging a native-memory leak inside a
third-party renderer, indefinitely.

Two earlier measurements in this investigation showed lottie-web 6–40× *faster*
than dotlottie. Both were artifacts: skia-canvas defers rasterization until
pixels are read, so a draw loop with no flush measures display-list
construction, not rendering. Any future benchmark here must force a flush per
frame.

## Engine choice: `@lottiefiles/dotlottie-web`

ThorVG compiled to WASM, one rasterizer for every environment. Verified by
probe (`scratchpad/probe/probe.mjs`, `probe2.mjs`) against v0.78.2 on Node
22.17, with **no DOM and no jsdom**:

| Claim | Result |
| --- | --- |
| Renders with no canvas at all | `canvas: { width, height }` (its `RenderSurface` type) is accepted; DOM branches are all guarded by `typeof HTMLCanvasElement !== "undefined"` |
| Frame-pure | `setFrame(n)` is synchronous; `buffer` holds that exact frame immediately after |
| Deterministic re-seek | seek 20 → 50 → 20 produced byte-identical buffers |
| Sub-frame seeking | `setFrame(20.5)` differs from `setFrame(20)` — real interpolation, so fps resampling is smooth |
| Pixel format | plain RGBA, straight alpha (pure red read back as `255,0,0,255`) — feeds `putImageData` directly |
| Speed (Node) | 0.18 ms/frame @512², 0.77 ms @1080², 2.7 ms @1920×1080 (simple fixture); 8.9 ms @1080p for a masked + matted + gradient fixture, **flat over 320 frames** |
| Offline WASM | `data:application/wasm;base64,…` loads without network; `file://` does **not** (Node's `fetch` rejects it and the lib silently falls back to unpkg) |
| Bundler WASM | `@lottiefiles/dotlottie-web/dotlottie-player.wasm` is an exported subpath, so `?url` imports work in Vite |

Its `layout.fit` vocabulary (`contain`/`cover`/`fill`/`none`) already matches
our `objectFit`, and `layout.align` matches `objectPosition`, so fitting is
delegated to the engine and rasterized at the right scale instead of scaling a
bitmap after the fact.

Cost: a 1.7 MB WASM binary. Paid only by apps that import the package.

## Package shape

`packages/lottie`, `@smoove/lottie`. Follows `@smoove/code`: `tsc -b` build,
`konva` + `@smoove/core` as peers, one public barrel, Vitest for the pure
logic. Added to the `fixed` group in `.changeset/config.json`; new-package
trusted-publisher registration flagged for the maintainer in the PR.

```
packages/lottie/src/
  index.ts             public barrel
  types.ts             LottieConfig
  lottie.ts            the node — FlexShape leaf, TICK_MARK, layout contract
  timing.ts            frame mapping (pure, unit-tested)
  engine.ts            LottieEngine interface + DI seam
  dotlottie-engine.ts  the dotlottie-web implementation
  wasm.ts              WASM URL resolution (browser CDN / Node data: URL)
  surface.ts           RGBA buffer → Konva canvas blit
```

## The node

`Lottie` is a `FlexShape(Konva.Shape)` leaf — same shape as `Code`, not a
`Group` like `Image`/`Video`, because the engine composites internally and we
paint a single bitmap through `sceneFunc`. It implements `KMLayoutNode`
(`_kmMeasure` / `_kmPlace`) and stamps `TICK_MARK`, so `Sequence`/`Clip` drive
it through the existing `_kmTick` contract. No engine changes in core.

```ts
new Lottie({
  src: "/anim.lottie",       // or data: <parsed JSON | string | ArrayBuffer>
  width: 400, height: 400,
  objectFit: "contain",      // → layout.fit
  objectPosition: "center",  // → layout.align
  speed: 1,                  // playback rate against composition time
  loop: true,
  trimBefore: 0,             // composition frames, as Video
  trimAfter: undefined,
  marker: "intro",           // optional Lottie marker as the segment
  segment: [0, 120],         // optional explicit lottie-frame range
  cornerRadius: 24,
})
```

`objectFit`, `objectPosition`, `trimBefore`/`trimAfter`, `loop`, `cornerRadius`
and the flex child props are deliberately spelled exactly as `Image`/`Video`
spell them. `speed`, `marker` and `segment` are the Lottie-specific additions.

## Frame mapping

The whole point of the package, and the only part with real logic, so it lives
in `timing.ts` as pure functions and gets the unit tests.

1. `Sequence` calls `_kmTick(localFrame)`.
2. Reuse core's `getMediaTime(localFrame, { fps, trimBefore, trimAfter, loop, playbackRate: speed })` → **seconds into the animation**. This is the same helper `Video` and `Audio` use, so trims and looping behave identically across all three node types.
3. `trimAfter` defaults, once loaded, to `round(animation.duration * comp.fps)` so `loop: true` wraps at the animation's natural end without the author computing anything.
4. `lottieFrame = clamp(seconds * animation.fps, segmentStart, segmentEnd)`.
5. `engine.setFrame(lottieFrame)` — fractional, with `useFrameInterpolation: true`.

A 24 fps Lottie in a 30 fps composition therefore resamples smoothly rather
than stuttering, and a 60 fps composition gets genuine 60 fps motion.

## Rendering path

Per frame, only when the resolved lottie frame actually changed:

1. `engine.setFrame(f)` → RGBA `Uint8Array` in WASM memory.
2. Copy into a persistent `ImageData` (the WASM buffer can be detached on
   resize, so we never hand it out by reference) and `putImageData` into an
   offscreen canvas from `Konva.Util.createCanvasElement()` — an
   `HTMLCanvasElement` in the browser, a skia-canvas surface under
   `@smoove/renderer`, with no branch on our side.
3. `sceneFunc` draws that canvas at the node's box, clipped to `cornerRadius`
   when set.

The render surface is allocated at `box × pixelRatio` (stage pixel ratio,
clamped) and reallocated only when that size changes, so the animation is
rasterized at output resolution rather than upscaled.

## Async loading

Two gates, matching what `Image` and `Font` already do:

- **Preview:** `comp.registerAsset(loadPromise)` — the composition shows
  `buffering` and holds playback until the WASM and the animation are ready.
- **Render:** `comp.delayRender("load lottie")` on first tick while
  `environment.isRendering`, cleared when the promise settles, so `renderFrame`
  never captures an empty frame.

A `lottie.ready` promise is also exposed for authors who want to `await` before
measuring.

## WASM resolution

One knob, `setLottieWasmUrl(url)`, plus environment-aware defaults:

- **Browser:** the library's own CDN default (zero config). Documented escape
  hatch for self-hosting: `import wasmUrl from "@lottiefiles/dotlottie-web/dotlottie-player.wasm?url"` then `setLottieWasmUrl(wasmUrl)`.
- **Node:** resolve the exported wasm subpath, read it, and hand over a
  base64 `data:` URL. Fully offline. Node-only modules (`node:module`,
  `node:fs`) are reached through a guarded dynamic import so browser bundlers
  never pull them in — and with `node:`-prefixed specifiers, because a bare
  `"module"` specifier is exactly what broke effects in server renders before
  (see the `gl-node.ts` guard).

Resolution and instantiation are memoized per process: one WASM instance
serves every `Lottie` node.

## Engine seam

`LottieEngine` is a small interface — `load`, `setFrame`, `buffer`, `resize`,
`fps`, `totalFrames`, `duration`, `intrinsicSize`, `destroy` — with
`setDefaultLottieEngineFactory()` for injection. The seam lives in this package,
not in core: unlike media (where the renderer must swap browser decoding for
Node decoding), the dotlottie engine is already environment-agnostic, so
`@smoove/renderer` needs no knowledge of Lottie at all. The interface exists so
the engine is stubbable in tests and replaceable later.

## Testing

Vitest, Node environment, matching `@smoove/code`:

- `timing.test.ts` — fps resampling, trims, loop wrap, segment/marker clamping, speed, edge frames. Pure, no engine.
- `surface.test.ts` — RGBA → ImageData blit, resize reallocation, no stale pixels.
- `engine.test.ts` — the real dotlottie engine against a small fixture animation: loads headlessly, `setFrame` is deterministic, intrinsic size and fps read back correctly.
- `lottie.test.ts` — the node driven through a real `Sequence` at several frames, asserting the engine received the expected lottie frames. Engine stubbed through the seam.

## Integration

- `packages/kitchen-sink`: a `lottie` composition in the registry, so it is exercised in the studio and through the server render queue.
- `packages/docs`: a docs page plus a live `<Demo>`; written with the `smoove-writing` skill.
- `doc/README.md`: updated, per the repo convention on public API changes.

## Out of scope

- State machines, theming, and slots. The engine supports them; nothing in smoove's model needs them yet, and they can be added without changing anything here.
- Interactivity (`stateMachineFireEvent` and friends) — a video frame renderer has no events to feed it.
- Editing Lottie JSON, or converting smoove scenes to Lottie.
- WebGL/WebGPU dotlottie backends. The software rasterizer is fast enough (2.7 ms/frame at 1080p) and is the only one that works headlessly.

## Risks

| Risk | Mitigation |
| --- | --- |
| 1.7 MB WASM in browser bundles | Only paid on import; documented self-hosting; loaded once per process |
| CDN default means a network hop in preview | Documented; `setLottieWasmUrl` makes self-hosting a one-liner |
| WASM buffer detaching on resize | Never hold a reference — copy into our own `ImageData` every frame |
| Node `fetch` rejecting `file://` (observed) | Ship the bytes as a `data:` URL instead; asserted by an engine test |
| dotlottie-web pre-1.0, API may move | Pinned range, isolated behind `LottieEngine` |
| Adds a third rasterizer — everything else in smoove draws through browser Canvas2D or skia, ThorVG is neither | Accepted deliberately. It buys identical pixels between preview and render, which the Canvas2D/skia split does not give us. The `LottieEngine` seam keeps the decision reversible |
