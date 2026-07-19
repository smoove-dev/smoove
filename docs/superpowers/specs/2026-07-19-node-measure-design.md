# Lifetime-independent `node.measure()` — design

Date: 2026-07-19
Type: design spec. Item #3 of the API-additions triage
(`2026-07-18-media-audio-text-api-triage.md`). Unblocks the knockout `Mask`
node (#5).

Status: **approved design, not yet implemented.**

---

## Problem

Measuring a node's rendered bounds is coupled to its sequence's lifetime, and
only the bounding box is available:

1. **Lifetime-coupled.** `Sequence._apply`
   (`packages/core/src/engine/sequence.ts`) runs updaters, ticks, and
   `_kmComputeLayout()` only while the sequence is in range. A node in an
   out-of-range sequence has never been laid out (or is stale), so measuring
   it — e.g. a hero mask opening from a flex tile in an earlier beat — reads
   (0,0) when seeking straight into the reveal. The workaround was keeping a
   dead sequence alive as scaffolding just to stay measurable.
2. **Box, not glyphs.** `getClientRect()` returns the bounding box. Masks and
   underlines anchored to text need the rendered glyph/ink bounds and the
   baseline, which nothing exposes.

The compute paths themselves are already lifetime-independent:
`Flex.computeLayout()` / `layoutRoot()` is pure attr+children math,
`Text._measure` / `_measureForFlex` measure a detached `Konva.Text`, and
`Text._buildGeometry()` already knows per-wrapped-line char ranges, rendered
line widths, and align offsets. The only missing pieces are an entry point
that drives those paths on demand, and ink-level vertical metrics.

Grounding notes:

- The font-aware measurement dependency (#2) already landed on `main`
  (PR #13, `3139b13`); the `feat/text-font-measurement` branch is a stale
  duplicate. This design builds on `main`.
- Pure layout math: server/client identical, frame-pure. Parity checklist at
  the end.

---

## Decisions (settled with Rotem, 2026-07-19)

| Question | Decision |
|---|---|
| Frame state | `measure(node)` = current props as-is; `measure(node, { at })` drives the owning sequence's frame state to local frame `at` first. |
| Text detail | Layout box + per-line rects + true ink rects + baseline. |
| Coordinate space | Stage space (absolute), axis-aligned. |
| Mutation | Run the real compute path in place; no scratch pass. Active sequences are restored (see Restore rule). |
| API shape | Free function `measure(node, opts?)` exported from `@smoove/core`, plus thin `measure()` sugar on the smoove wrappers. No `Konva.Node.prototype` patching (multiple-Konva-copies hazard). |

---

## API

```ts
import { measure } from "@smoove/core";

measure(node);              // bounds at current props
measure(node, { at: 132 }); // drive owning sequence to local frame 132 first
tile.measure({ at: 132 });  // sugar on Flex/Block/Text/Image/shape wrappers

type MeasureOptions = {
  /** Owning sequence's local frame to measure at. Runs the sequence's
   *  updaters + ticks (no visibility change, no draw) before layout. */
  at?: number;
};

type Rect = { x: number; y: number; width: number; height: number };

type Measurement = Rect & {
  /** Text only: one entry per rendered (wrapped) line, top to bottom. */
  lines?: MeasuredLine[];
};

type MeasuredLine = Rect & {          // the line box: rendered width, lineH tall
  /** Tight rect around the actual glyph ink (cap/ascender top, descender
   *  bottom, left/right bearings). Falls back to the line box where
   *  actualBoundingBox metrics are unavailable. */
  ink: Rect;
  /** Stage-space y of the alphabetic baseline — underline anchor. */
  baseline: number;
  /** Char offsets into the displayed (post-fit/clamp) text. */
  range: { start: number; end: number };
};
```

All rects are **stage-space axis-aligned bounding boxes** obtained by pushing
local geometry through `getAbsoluteTransform()`. A rotated node yields the
AABB of its rotated box (documented; masks on rotated text are out of scope).

Applicability: any Konva node works with the free function — smoove wrappers
and raw Konva children alike. Only `Text` populates `lines`; every other node
returns the box alone.

---

## Architecture

New module `packages/core/src/layout/measure.ts` owning the algorithm; two
small contract extensions; sugar methods on the wrappers.

### Algorithm

`measure(node, { at })` runs four steps:

1. **Resolve the sequence.** `node.getLayer()`, checked as a `Sequence`.
   Required only when `at` is given (throw otherwise: *"measure: { at }
   requires the node to be inside a Sequence"*). Without `at`, a detached
   node measures fine — its "stage space" is then the root-most ancestor's
   space (documented).
2. **Frame pass** (only with `at`): run the sequence's updaters at local
   frame `at`, then tick `TICK_MARK` nodes — the middle of `_apply` with
   visibility and drawing stripped out. Media-only nodes (`MEDIA_MARK`
   without `TICK_MARK`) are **not** ticked: media state never affects layout,
   and ticking a video at a foreign frame would trigger spurious seeks. To
   keep the two callers from drifting, that middle section is extracted from
   `_apply` into an internal `Sequence._kmRunFrame(local, tickMedia)` that
   both call (`_apply` passes `tickMedia: true`). The sequence's
   `_active`/`_lastLocal`/visibility are **not** touched by the frame pass
   itself (but see Restore rule).
3. **Layout pass:** walk `node`'s ancestor chain (including `node` itself)
   up to the layer and call `_kmComputeLayout()` on the **outermost**
   `isKMLayoutRoot` found. Only that root — flex roots are independent, so
   sibling roots stay untouched. No root in the chain → skip (manually
   placed nodes; `Text` lays itself out in `setText`/`_kmTick`).
4. **Read-back:** the node's local layout box (`width()`/`height()` at local
   origin, origin-corrected via `getSelfRect()` for raw shapes, mirroring
   `writeBack`) is pushed through `getAbsoluteTransform()` → stage AABB.
   If the node implements the new `_kmMeasureLines` hook, transform each
   local line the same way and attach `lines`.

### Restore rule

If the sequence is **active** (visible, in range) and `at` differs from its
live local frame, the frame pass has desynced the visible canvas — and
`_apply`'s `_lastLocal` dedupe would skip repainting it. So before returning,
`measure` re-runs `_kmRunFrame` at the live local frame. Frame purity makes
this restoration exact. Inactive sequences keep the measured state (decision
above): harmless because activation re-derives everything.

### Contract extensions (`layout/contract.ts`)

```ts
export type LocalMeasuredLine = {
  rect: LayoutBox;                       // line box, node-local
  ink: LayoutBox;                        // glyph ink, node-local
  baseline: number;                      // node-local y
  range: { start: number; end: number };
};

export interface KMLayoutNode {
  // ...existing...
  /** Text-like leaves: per-rendered-line geometry in local space. */
  _kmMeasureLines?(): LocalMeasuredLine[];
}
```

Keeps `measure.ts` free of `instanceof Text` — the same open-contract
philosophy as `_kmMeasure`/`_kmPlace`, no engine edits for future text-like
nodes (e.g. `@smoove/code`).

### `Text._kmMeasureLines()`

Built from what `Text` already has, plus ink metrics:

- Line boxes come straight from `_geo`: for line `li` with range `r`,
  `x = pad + alignOffset(geo, r.width)`, `y = pad + li * lineH`,
  `width = r.width`, `height = lineH`.
- **Ink + baseline:** verified against Konva 10.3's `Text._sceneFunc`
  (`lib/shapes/Text.js:137-150`): in the default (non-legacy) path Konva
  draws with `textBaseline: "alphabetic"`, placing the baseline at
  `translateY = (fontAscent − fontDescent) / 2 + lineH / 2` from the top of
  each line box, where `fontAscent`/`fontDescent` come from
  `measureSize("M")`'s `fontBoundingBox{Ascent,Descent}` (falling back to
  `actualBoundingBox*`). So per line: `baseline = pad + li * lineH +
  translateY`. A scratch context with the identical font string
  (`_getContextFont()`) and `textBaseline = "alphabetic"` then makes
  `measureText(lineText)` return `actualBoundingBox{Ascent,Descent,Left,
  Right}` relative to that baseline: `ink.top = baseline − ascent`,
  `ink.bottom = baseline + descent`, `ink.left = lineStartX −
  actualBoundingBoxLeft`, `ink.right = lineStartX + actualBoundingBoxRight`.
  Set `ctx.letterSpacing` when the environment supports it so spaced runs
  measure true. With `Konva.legacyTextRendering` enabled the anchor math
  differs (middle baseline at `lineH / 2`); that mode gets the fallback below.
- Fallback: environments without `actualBoundingBox*` metrics (and the
  legacy-rendering mode) get `ink = rect` and no exact baseline claim
  (`baseline = rect.top + translateY` best-effort); skia-canvas ≥3 and all
  modern browsers have the real metrics.
- A pixel-bracket test (render a line, scan non-transparent pixels, assert
  the ink rect brackets them within tolerance) validates this math on skia;
  it is part of the test plan, not an assumption inherited silently.

### Wrapper sugar

`Flex`, `Block`, `Text`, `Image`, and the shape wrappers gain:

```ts
measure(opts?: MeasureOptions): Measurement {
  return measure(this, opts);   // the free function
}
```

### Guards

- **Re-entrancy:** a module-level `measuring` flag; calling
  `measure(..., { at })` from inside a measure-driven frame pass throws
  (*"measure: cannot re-enter with { at } from a frame updater"*). Plain
  `measure(node)` from an updater stays legal — cross-sequence per-frame
  measurement from `register()` is a supported pattern and costs one
  `_apply`-equivalent without a draw.
- **Fonts:** `measure()` is synchronous and reflects currently-loaded faces.
  Browser callers wanting final glyph bounds await `comp.whenReady()` (the
  existing buffering gate); the server registers fonts up front, so bounds
  are always final there. No new readiness gate.

---

## Not doing (YAGNI)

- Memoization / caching of measurements (inputs are frame-pure; call again).
- `space: "local"` option — stage only; callers can invert transforms.
- `at: "last"` sugar or composition-frame anchoring — `at` is the owning
  sequence's local frame, numbers only.
- Per-glyph rects — per-line ink is what `Mask` needs.
- `Konva.Node.prototype` augmentation.

---

## Testing

- **Unit (server = same math):** vitest under the renderer's skia
  registration. Cases: flex tile in a never-activated sequence measures
  non-zero and matches the active-sequence layout for the same frame;
  `{ at }` respects updater-driven props (e.g. a width interpolate);
  typewriter `{ at }` reflects the reveal-dependent height
  (`reserveHeight: false`); Text line count/width/ink sanity vs
  `measureText`; restore rule leaves an active sequence's state at its live
  frame; re-entrancy throw; `{ at }` without a sequence throws.
- **Pixel check (implementation phase):** render a line of text and assert
  the reported ink rect brackets the actual non-transparent pixels within a
  tolerance — validates the Konva `middle`-baseline anchor math on both
  skia and a browser canvas.
- **Docs demo:** the hero-mask scenario — beat B measures beat A's flex tile
  via `tile.measure({ at: lastFrameOfA })` and opens a reveal from it,
  verified by seeking straight into beat B (no scaffolding sequence). Lives
  with the other live demos in `packages/docs/src/demos/`.

## Parity checklist (from the triage doc)

- [ ] Works via `setFrame(n)` in Node (offline/server), not only under
      `play()` — measure never touches draw/visibility, layout math shared.
- [ ] Frame-pure: same `(node state, at)` in → same measurement out; restore
      rule re-derives active-sequence state exactly.
- [ ] Async resources: fonts resolve before frame 0 via the existing
      buffering/delayRender gates; measure documents the pre-ready caveat.
- [ ] No decoded-media dependency: the frame pass skips media-only ticks
      entirely (layout never depends on them); nothing decoded or seeked at
      measure time.
