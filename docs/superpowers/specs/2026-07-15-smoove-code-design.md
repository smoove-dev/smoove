# `@smoove/code` — animated source code for smoove

**Status:** design approved, pre-implementation
**Date:** 2026-07-15
**Author:** Rotem (with Claude)

## Summary

A new leaf package, `@smoove/code`, that renders syntax-highlighted source
code as a first-class smoove node and animates smoothly between code states
(typing, diffing, editing, selecting). It is modeled on
[motion-canvas's Code component](https://github.com/motion-canvas/motion-canvas/tree/main/packages/2d/src/lib/code),
but adapted to smoove's frame-pure animation model: everything is a pure
function of the frame, driven from inside a `Sequence.register` updater, and
authored with `interpolate`-family helpers that mirror smoove's existing
`interpolate(input, inputRange, outputRange)`.

The `Code` node behaves like `Text`: a self-contained, layout-aware primitive
you can drop into a composition and animate over the frame clock.

## Goals

- A `Code` node that renders highlighted, multi-line, monospace code, in both
  the browser and the skia server renderer.
- Smooth animated transitions between whole-code snapshots (the crossfade /
  morph that motion-canvas is known for).
- Per-range edits (insert / replace / remove at a `CodeRange`) and selection
  highlighting (dim unselected code), also animated.
- An API that "feels smoove": frame-first, `interpolate`-shaped, no signals or
  generators.
- The package is the first in the repo to ship Vitest unit tests, covering the
  pure diff / range / interpolation logic.

## Non-goals (this version)

- Custom per-token `drawHooks` (glow, blur, effects integration). A seam is
  noted for phase 2 but not implemented now.
- Live editing / interactive cursors. This is a render-time animation library,
  not an editor.
- Bundling language parsers. The user brings their own `@lezer/*` language
  parser.

## Target API

```ts
import {
  Code, interpolateCode, interpolateEdit, interpolateSelection,
  LezerHighlighter, insert, remove, replace, lines, word,
} from '@smoove/code';
import { parser } from '@lezer/javascript';

const highlighter = new LezerHighlighter(parser /*, style? */);

const code = new Code({
  content: `const number = 7;`,     // string | CodeContent
  highlighter,                       // optional; without it, no colors
  font,                              // Font | FontFaceRef (monospace)
  fontSize: 32,
  lineHeight: 1.4,
  fill: '#d8dee9',                   // color used when no highlighter
  // + Konva/layout props (x, y, width, …) filtered via pickKonvaConfig
});

main.add(code);

// whole-snapshot morph (the primary use case)
main.register((f) => {
  code.setContent(interpolateCode(f, [0, 100], [
    `const number = 7;`,
    `const number = createSignal(7);`,
  ]));
});
```

### API surface

```ts
// Node
class Code extends Konva.Shape implements KMLayoutNode {
  constructor(config: CodeConfig);
  setContent(content: string | CodeContent): this;
  setSelection(selection: PossibleCodeSelection): this;
  parsed(): string;                                   // current code as a string
  findRanges(pattern: string | RegExp): CodeRange[];
  findFirstRange(pattern: string | RegExp): CodeRange | null;
  getPointBBox(point: CodePoint): BBox;
  getSelectionBBox(selection: PossibleCodeSelection): BBox[];
}

// Frame-pure helpers (pure functions of the frame; return values feed the setters)
interpolateCode(
  frame: number, inputRange: readonly number[],
  snapshots: readonly (string | CodeContent)[], options?: InterpolateOptions,
): CodeContent;

interpolateEdit(
  frame: number, inputRange: readonly number[],
  base: string | CodeContent, edits: Edit[], options?: InterpolateOptions,
): CodeContent;

interpolateSelection(
  frame: number, inputRange: readonly number[],
  selections: readonly PossibleCodeSelection[], options?: InterpolateOptions,
): CodeSelection;

// Edit descriptors
function insert(point: CodePoint, code: string): Edit;
function remove(range: CodeRange): Edit;
function replace(range: CodeRange, code: string): Edit;

// Range constructors
function lines(from: number, to?: number): CodeRange;
function word(line: number, column: number, length?: number): CodeRange;
function pointToPoint(sl: number, sc: number, el: number, ec: number): CodeRange;

// Highlighter
class LezerHighlighter implements CodeHighlighter { constructor(parser: Parser, style?: HighlightStyle); }
```

`InterpolateOptions` is imported from `@smoove/core` (`easing`,
`extrapolateLeft`, `extrapolateRight`), so easing and clamping behave exactly
like the core `interpolate`.

### Usage examples

Per-range edit (avoids an ambiguous whole-string diff):

```ts
main.register((f) => {
  code.setContent(
    interpolateEdit(f, [0, 60], `const n = 7;`, [
      replace(word(0, 6, 1), 'value'),
    ]),
  );
});
```

Animated selection (dim everything except the matched range):

```ts
code.setContent(`const number = createSignal(7);`);
main.register((f) => {
  code.setSelection(
    interpolateSelection(f, [0, 30], [[], code.findRanges('createSignal')]),
  );
});
```

Multi-stop chaining (a → b → c) works because the helpers reuse `interpolate`'s
multi-range semantics:

```ts
interpolateCode(f, [0, 50, 100], [a, b, c]);
```

## Architecture

### Frame-pure adaptation (the central design decision)

motion-canvas represents code as a reactive tree of fragments, each carrying a
`before` and an `after` value, with a `progress` signal in `[0,1]` that morphs
between them. A generator tweener advances `progress`.

smoove has no signals or generators. So:

1. The `interpolate*` helpers are **pure functions of the frame**. They do *not*
   compute the diff. Each returns a lightweight `CodeContent` **descriptor**:
   - `interpolateCode` → `{ kind: 'diff', from, to, progress }`
   - `interpolateEdit` → `{ kind: 'edit', base, edits, progress }`
   - a plain string or already-resolved content → `{ kind: 'static', … }`

   The helper's only job is to pick the active segment from `inputRange`,
   compute the local `progress` via core's `interpolate(frame, [lo, hi], [0, 1],
   options)`, and clamp outside the range.

2. `code.setContent(content)` **resolves** the descriptor. It runs the
   patience diff (or applies the edit descriptors) using the node's own
   highlighter tokenizer, so the diff aligns on real syntax boundaries. The
   resolved `{ progress, fragments }` scope is stored on the node and drawn by
   `sceneFunc`.

3. **Memoization:** `setContent` caches the resolved fragments keyed on the
   descriptor's `(from, to)` (or `(base, edits)`) identity. Snapshots are stable
   string literals referenced every frame, so the diff runs **once per
   transition**; per frame, only `progress` changes and the node redraws. This
   keeps scrubbing and offline render cheap.

This is why tokenization lives in the node (where the highlighter is), not in
the free helper functions.

### Data model (ported from motion-canvas)

Pure, unit-tested modules:

- `CodeMetrics` — a measured string: `{ content, newRows, endColumn,
  firstWidth, maxWidth, lastWidth }`, widths in mono-glyph units.
- `CodeFragment` — `{ before: CodeMetrics, after: CodeMetrics }`, the atom of a
  diff. `RawCodeFragment` = `{ before: string, after: string }`.
- `CodeScope` — `{ progress: number, fragments: CodeTag[] }`. A `CodeTag` is a
  string (unchanged), a fragment (change), or a nested scope.
- `tokenizer` — `highlighter.tokenize` when a highlighter is present, else a
  whitespace/bracket fallback (`defaultTokenize`).
- `patienceDiff(a: string[], b: string[])` — faithful patience diff over token
  arrays, marking each run keep / insert / delete.
- `defaultDiffer(from, to, tokenize)` — coalesces the diff into a `CodeTag[]`:
  unchanged text stays a plain string; changes become `{ before, after }`
  fragments (`{before:'', after:'x'}` = insertion, etc.).
- `CodeRange` / `CodePoint` — `[line, column]` points and `[from, to]` ranges;
  constructors `lines`, `word`, `pointToPoint`; `findAllCodeRanges(code,
  pattern)`; helpers `isPointInCodeRange`, `consolidateCodeRanges`.
- `extractRange(range, fragments)` — rewrites the fragment list so a targeted
  span becomes its own isolated fragment; backs `insert` / `replace` / `remove`.
- `insert` / `replace` / `remove` — `Edit` descriptors resolved by
  `interpolateEdit` / `setContent`.

### Highlighter

Port the contract verbatim (small, worth copying exactly):

```ts
interface HighlightResult { color: string | null; skipAhead: number; }
interface CodeHighlighter<T = unknown> {
  initialize(): boolean;                              // readiness (async-capable)
  prepare(code: string): T;                           // parse once, cache
  highlight(index: number, cache: T): HighlightResult;
  tokenize(code: string): string[];
}
```

`LezerHighlighter` implements it over a `@lezer/common` `Parser` plus a
`@codemirror/language` `HighlightStyle`:

- Constructor extracts `className → color` from `style.module.getRules()`.
- `prepare` parses to a lezer `Tree`, runs `highlightTree` to fill a
  `position → color` lookup.
- `highlight(index, cache)` does `tree.resolveInner(index, 1)`, returns the
  node color and `skipAhead = node.to - index` so a whole token draws as one
  run.
- `tokenize` walks the tree cursor emitting leaf slices (and the gaps between
  them).

Ship one default `HighlightStyle` (a Nord-ish dark theme) so
`new LezerHighlighter(parser)` works with no theme argument. Override via the
second constructor argument.

### Rendering

`class Code extends Konva.Shape` with a custom `sceneFunc`, rather than a Group
of Konva nodes like `Text`. The `Shape` + `sceneFunc` approach gives per-glyph
`fillText` control for the crossfade and runs on both the browser canvas and
the skia server context (Konva's `sceneFunc` receives whatever 2D context the
backend provides).

A ported `CodeCursor` performs a measure-then-draw walk producing a flat list
of drawing instructions:

- **Measurement:** `monoWidth = measureText('X').width`; line height from
  `fontSize * lineHeight`; all horizontal positions computed in mono-glyph
  units (`round(measureText(str).width / monoWidth)`) and multiplied by
  `monoWidth` only at the end. This keeps columns aligned.
- **Crossfade:** for a changed fragment, `alpha = clampRemap(1, 0.2, 1, 0,
  |progress - 0.5| * 2)` so old content fades out toward the midpoint and new
  content fades in past it; the drawn side flips at `progress = 0.5`.
- **Layout shift:** `map(before, after, progress)` on line/width advances, so
  the bounding box grows and shrinks continuously and following lines slide.
- **Color:** per-token color from the highlighter; when the text is identical
  but the token class changed (identifier → keyword), lerp the color instead of
  fading to avoid a pop.

The node implements the `KMLayoutNode` contract (`_kmMeasure`, `_kmPlace`,
`_kmRole = "leaf"`) so it participates in Flex/Block layout like `Text`. Font is
resolved via `config.font.face()` exactly like `Text`, with a
`fontRef.whenReady().then(() => this.getLayer()?.batchDraw())` relayout hook for
fonts that load after first paint.

`sceneFunc` reads the node's current resolved state each draw. `Sequence._apply`
already calls `batchDraw()` after running updaters every frame, so
`setContent` in a `register` updater redraws naturally.

### Selection

`setSelection(sel)` stores a `CodeSelection` (`CodeRange[]`). The default draw
behavior dims unselected tokens (`globalAlpha *= 0.2`). `interpolateSelection`
animates between two selection sets by lerping each token's selected-ness over
`progress`. Custom `drawHooks` are a phase-2 seam, not implemented now.

### Font / monospace

`font` (a smoove `Font` or `FontFaceRef`) is the recommended path; server
rendering works through the existing skia font loader. Falls back to a
`fontFamily` string, default `'monospace'`. Documentation points at a monospace
family from `@smoove/google-fonts` (e.g. Cascadia Code, DM Mono) for server
renders.

## Packaging

Modeled on `packages/transitions`:

- `"type": "module"`, `main`/`module`/`types` → `dist`, `exports { "." }`,
  `files: ["dist"]`.
- Scripts: `build: tsc -b`, `dev: tsc -b --watch`, `clean`, `prepublishOnly`,
  plus `test: vitest run` and `test:watch: vitest`.
- `peerDependencies`: `@smoove/core` (`workspace:^`), `konva` (`>=10`).
- `dependencies`: `@lezer/common`, `@lezer/highlight`, `@codemirror/language`.
- `tsconfig.json` extends `tsconfig.base.json` (`rootDir: src`, `outDir: dist`).
- Added to the root `tsconfig.json` project references.
- A changeset for the initial release.
- ESM `.js` import suffix convention throughout the source.

## Testing

`@smoove/code` is the first Vitest package in the repo (root gains `vitest` as a
dev dependency; AGENTS.md already anticipates this). The pure layers get real
unit tests:

- `patienceDiff` — keep/insert/delete alignment on token arrays.
- `defaultDiffer` — coalescing into fragments (pure insert, pure delete,
  replace, mixed).
- `tokenizer` — whitespace/bracket fallback boundaries.
- `CodeRange` constructors + `findAllCodeRanges` + `extractRange`.
- `insert` / `replace` / `remove` edit application.
- `interpolateCode` / `interpolateEdit` — segment selection and local progress
  across single and multi-stop ranges, plus extrapolation clamping.
- `LezerHighlighter.prepare` / `highlight` — colors on a small JS snippet.

Rendering (cursor + node) is verified by rendering a kitchen-sink demo
composition end to end rather than by pixel unit tests.

## Risks

- **skia glyph metrics.** motion-canvas reads
  `measureText(...).fontBoundingBoxAscent/Descent`. If skia-canvas does not
  expose these, fall back to `fontSize * lineHeight` for line height and an
  ascent estimate. **Mitigation:** a small measurement spike is the first
  implementation step, before the cursor is built.
- **Diff quality without a highlighter.** The fallback tokenizer produces
  coarser diffs than syntax-aware tokenization. Acceptable; documented. Passing
  a highlighter is the recommended path.
- **Long-file performance.** Per-token `fillText` each frame on very large
  snippets could be slow. Acceptable for this version (diff is memoized);
  offscreen-canvas caching of the drawing pass is a known later optimization.

## Build order

0. skia `measureText` / `fontBoundingBox` spike.
1. Data model + tokenizer (`CodeMetrics`, `CodeFragment`, `CodeScope`,
   `defaultTokenize`).
2. Diff + differ (`patienceDiff`, `defaultDiffer`).
3. Ranges + edits (`CodeRange`, `extractRange`, `insert`/`replace`/`remove`).
4. Highlighter (`CodeHighlighter`, `LezerHighlighter`, default theme).
5. Interpolate-family helpers (`interpolateCode`/`Edit`/`Selection`).
6. Rendering (`CodeCursor`, `Code` node, font resolution, `setContent` /
   `setSelection`).
7. Package wiring (`package.json`, `tsconfig`, root references, `index.ts`,
   changeset) + a kitchen-sink demo composition for end-to-end verification.

Layers 1–5 are pure and unit-tested; 6–7 are verified by the demo.
