# Layout conformance suite and capability report

Date: 2026-08-10
Status: approved, ready for planning

## Why

smoove's layout system is one of its headline claims: CSS-flexbox-like auto
layout on a canvas, reflowed every tick. Today that claim rests on three
regression tests in `packages/core/src/layout/align-hug.test.ts` plus a few
measure/text tests. There is no systematic coverage of the flex props, no
coverage at all of `Block`'s paint, and no artifact anyone can point at to
answer "what can smoove's layout actually do".

This spec defines one corpus of small fixture compositions that serves both
needs: it is the test suite, and it generates the capability report.

## Scope

**In scope.** Every layout ability smoove exposes today: the container props
(`flexDirection`, `justifyContent`, `alignItems`, `gap`, `padding`), the child
props (`flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `margin`), sizing
(`px`, `%`, hug-content), `Block`'s paint (background, gradients, borders,
corner radius, shadow), and the four hard areas where layout bugs actually
live: animated reflow, `Text` as a flex child, nesting and hug-content chains,
and mixed leaf types.

**Out of scope, documented not tested.** Abilities flexily supports and smoove
does not expose: `flexWrap`, `alignContent`, `minWidth`/`maxWidth`/
`minHeight`/`maxHeight`, `aspectRatio`, `position: absolute` with edge offsets,
separate row/column gaps, `auto` margins, percent `flexBasis`, baseline
alignment. These appear in the report as a gap list.

**Out of scope entirely.** Browser-vs-skia backend comparison. The suite
verifies geometry and skia-rendered pixels; a third browser leg is a later
decision.

## Verification depth

Two legs per case:

1. **Geometry.** Stage-space boxes via `probeAt` / `measure`, asserted against
   numbers derived by hand from CSS flexbox semantics.
2. **Pixels.** The same composition rasterized through `comp.captureCanvas()`
   (the skia backend the server renderer uses), sampled at named points.
   Targeted probes only: background colour at a card's centre, border colour on
   an edge, transparency inside a rounded corner, gradient endpoints differing.
   No golden images — they break on every antialiasing, font, or skia version
   change.

The rasterized canvas also yields the report's PNG, so the picture in the
report is the exact surface the pixel assertions ran against.

Feasibility is verified, not assumed: a spike built a `Block` row with
`justify-content: space-between`, asserted child boxes at `(20,70,100,60)` and
`(280,70,100,60)`, read `#101820` inside a 12px rounded corner where the card's
`#4ea1ff` would be without the radius, and produced a PNG data URL — all inside
core's existing vitest + `konva/skia-backend` rig, in 64ms.

## Conformance, not change detection

Expected values are derived from CSS flexbox rules, never copied from what
smoove currently outputs. `space-between` in a 400px row holding three 100px
children means x = 0, 150, 300 because that is what CSS specifies.

Consequence: some cases are expected to fail on the first run. Each failure is
triaged into exactly one of three buckets:

- **smoove bug** — fix it.
- **flexily bug** — work around it in `flex/flex.ts` with a comment naming the
  flexily version, the way `fixNaNCross` already does, and note it in the report.
- **deliberate divergence** — canvas-specific behaviour smoove chooses on
  purpose. Document it in the report so it reads as a decision, not a defect.

A case that cannot be made to pass is not deleted; it is marked and explained.

## The unit

```ts
type LayoutCase = {
  id: string;          // "justify-space-between-row"
  group: string;       // "Main axis"
  title: string;       // "justifyContent: space-between"
  note: string;        // one line of prose for the report
  size?: [number, number];              // canvas, default 480x240
  build: (root: Block) => void;         // shown verbatim in the report
  frames?: number[];                    // frames to assert at, default [1]
  expect: (probe: CaseProbe, frame: number) => void;
};
```

`build` is the single source of truth. The report renders `build.toString()`,
dedented, so the code on the page is literally the code that produced the
picture next to it. Hand-written code strings would drift; extracted source
cannot.

`CaseProbe` exposes what the assertions need:

- `box(selector)` — stage-space `{ x, y, width, height }`.
- `boxes(selector)` — the same for every match, in tree order.
- `at(x, y)` — the rendered pixel as a hex string.
- `expectColor(x, y, hex, tolerance?)` — pixel assertion with an AA tolerance.
- `node(selector)` — escape hatch.

## Coverage

Roughly 80 cases in nine groups.

| Group | Cases | What it pins down |
| --- | --- | --- |
| Main axis | 4 directions x 6 `justifyContent` = 24 | the full distribution grid, `row-reverse` and `column-reverse` included |
| Cross axis | 4 `alignItems` x row/column = 8, plus 5 `alignSelf` | 13 |
| Sizing | px, `%`, hug, `flexGrow` 1-vs-2, `flexShrink` under overflow, `flexBasis`, grow+basis together | ~8 |
| Spacing | `gap` in row and column, `padding` in all four notations, `margin` in all four, margin interacting with justify | ~9 |
| Block paint | solid background, linear gradient with angle, radial gradient, uniform border, per-edge border colour and size, dashed border, uniform `cornerRadius`, per-corner array, shadow | ~10 |
| Nesting and hug | three-deep nesting, `%` resolving against a hug parent, `alignItems: center` in a hug parent (the `fixNaNCross` case), a `flexGrow` spacer, a hug root whose background sizes to its content | ~6 |
| Text as child | wrapping to available width, hug width, `fitText` in a fixed box, `maxLines` with ellipsis, text in a column parent versus a row parent, text beside a growing sibling | ~6 |
| Mixed leaves | `Circle` origin correction, `Star`, `Image` intrinsic size and `objectFit`, raw `Konva.Rect` fallback, explicit size on a radius shape, an invisible child taking no space | ~6 |
| Animated reflow | animating `gap`, animating `flexGrow`, animating root `width`, a child toggling visibility mid-timeline, text content changing | ~5, each asserted at three frames |

Images use an injected `loader` returning a synthetically painted canvas. No
file IO, no network, deterministic.

## Layout on disk

```
packages/core/conformance/
  types.ts                  LayoutCase, CaseProbe
  harness.ts                build, tick, probe, rasterize; colour helpers
  cases/
    main-axis.ts  cross-axis.ts  sizing.ts  spacing.ts  block-paint.ts
    nesting.ts    text.ts        leaves.ts  reflow.ts
  corpus.ts                 the flat array
  conformance.test.ts       iterates the corpus
  report.ts                 writes out/report.html
  out/                      gitignored
```

The folder sits beside `src/`, not inside it: core's tsconfig compiles all of
`src` into `dist`, and consumers should not download 80 fixtures. A
`tsconfig.conformance.json` keeps the folder typechecked. vitest picks up
`conformance.test.ts` with no config change, since its default include pattern
is package-root-relative.

The test run regenerates `out/report.html` on every pass, so a green suite can
never have a stale report.

## The report

A self-contained HTML page, published as an artifact.

- Header: pass counts, case count, the smoove version, generation date.
- One section per group. Each case is a card: title, note, verbatim `build`
  source, the rendered PNG inlined as a data URI, and the measured geometry
  below it.
- The main-axis group renders as a 4x6 grid, which alone answers "what can
  smoove's flexbox do" at a glance.
- Any case triaged as a deliberate divergence or an upstream workaround carries
  a visible marker with its explanation.
- Closing section: the gap list of flexily-capable, smoove-unexposed props, so
  the report doubles as the roadmap for extending `FlexProps`.

Theme-aware, no external requests, PNGs inlined.

## Risks

- **The `Text` measure path.** `engine.ts` carries two undocumented flexily
  argument quirks and a `+1` fudge on measured width. The text group is the
  most likely source of first-run failures, and the hardest to triage.
- **Radius-based shapes under `flexGrow`.** The mixin documents that `flexGrow`
  distorts radius-derived geometry but nothing enforces it. The leaves group
  will pin down the current behaviour so a future fix has a baseline.
- **Hug main axis.** `fixNaNCross` handles `center` and `flex-end` in a hug
  cross axis. Whether `space-*` justify inside a hug *main* axis has the same
  NaN problem is unknown and worth a case.
- **Case count creep.** Eighty cases at ~65ms is about five seconds. Any case
  needing font loading or a large canvas costs more; keep canvases small.

## Not doing

- Browser-vs-skia pixel comparison.
- Golden-image snapshots.
- Failing or skipped tests standing in for the unexposed props.
- Any change to `FlexProps` itself. This spec measures what exists; extending
  the API is a separate piece of work the gap list feeds.
