# Text

`Text` (from `@smoove/core`) extends `Konva.Group`, **not** `Konva.Text` —
it wraps Konva text internally to support flex layout, wrapping, fit,
typewriter reveal, and highlights. Two consequences:

- To change content after construction, call `.setText("new copy")` — not
  `.text(...)` (that's the raw Konva API and isn't wired through). Likewise
  `.setFill("#color")` recolors and `.setFont(font)` swaps the face (both
  return `this`). Use `.setFill()` to animate/tint text color instead of
  faking it with a transparent `highlight` — e.g. `text.setFill(interpolateColors(...))`
  in `register()`.
- It participates in `Flex`/`Block` layout like any other wrapper (`width`,
  `flexGrow`, `alignSelf`, …).

## Basic usage

```ts
import { Text } from "@smoove/core";

const heading = new Text({
  text: "Auto layout, no manual math",
  fontSize: 22,
  fontStyle: "bold",      // Konva fontStyle string, e.g. "bold", "italic", "700"
  fill: "#f9fafb",
  align: "center",         // "left" | "center" | "right" | "justify"
  lineHeight: 1.4,
  letterSpacing: 0,
  width: "100%",            // px or "%", like other flex sizing
  wrap: "word",             // "word" | "char" | "none"
});
```

Use `Text` for every label, not just ones that need flex/fit/typewriter/
highlights — it's the project convention to import from `@smoove/core`
rather than reach for `Konva.Text` directly, and a plain `Text({ text, ... })`
with no `width`/flex parent behaves like a normal static label.

## Fit-to-box

```ts
fitText: { min: 14, max: 64, step: 0.5 },  // binary-searches a font size that fills the box
maxLines: 2,
ellipsis: true,
trimBy: "word",  // "word" | "letter" — how overflow is cut before the ellipsis
```

## Typewriter reveal

```ts
const body = new Text({
  width: "100%",
  text: "This message types itself out, word by word.",
  typewriter: {
    mode: "word",                  // "letter" | "word"
    durationInFrames: 90,           // spreads the full reveal across N frames (overrides `step`)
    cursor: { color: "#fff" },      // or `true` for defaults, or omit for no caret
    fade: true,                     // fade each revealed unit in
    reserveHeight: true,            // default — box doesn't reflow as it types (false: it grows)
  },
});
```

`startFrame` delays the reveal start (local frames) — use it to stagger
several typewriters off one sequence's clock instead of nesting sequences.

## Highlights

A highlight is a marker drawn behind a character range; animate `progress`
(0→1) in `register()` to sweep it in:

```ts
import type { HighlightConfig } from "@smoove/core";

const hl: HighlightConfig = {
  start: text.indexOf("important part"),
  end: text.indexOf("important part") + "important part".length,
  background: "#f0c000",
  color: "#0d1117",       // optional text-color override inside the run
  cornerRadiusStart: 4,
  cornerRadiusEnd: 4,
  progress: 0,
};
const node = new Text({ text, highlights: [hl], fontSize: 20 });

main.register((local) => {
  hl.progress = interpolate(local, [70, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  node._layoutText(); // re-render the mark — see the re-layout gotcha below
});
```

Mutate the `HighlightConfig` object in place (as above) — `Text` reads it
live, no `setText()`/re-construction needed. **Gotcha:** that mutation only
becomes *visible* when the node re-lays-out, which happens automatically
only if the node is a `Flex`/`Block` child (the layout pass re-lays-out
every child each tick) **or** it also has `typewriter` configured (a
typewriter ticks itself every frame). A standalone `Text` — added straight
to a `Sequence`, no `typewriter` — does **not** re-layout on its own, so
call `node._layoutText()` yourself, right after mutating the highlight,
inside `register()`.

## Fonts

`font: someFont` or `font: someFont.face("700")` (a `Font`/`FontFaceRef`)
overrides `fontFamily`/`fontStyle` and triggers an automatic re-layout once
the face finishes loading — see [fonts.md](fonts.md) for declaring a `Font`
or pulling one from `@smoove/google-fonts`.

See `rules/assets/text-typewriter.composition.ts` for typewriter + highlight
combined in one scene.
