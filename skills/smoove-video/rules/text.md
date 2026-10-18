# Text

`Text` (from `@smoove/core`) extends `Konva.Group`, **not** `Konva.Text` —
it wraps Konva text internally to support flex layout, wrapping, fit,
typewriter reveal, and highlights. Two consequences:

- To change content after construction, call `.setText("new copy")` — not
  `.text(...)` (that's the raw Konva API and isn't wired through), and read
  it back with `.getText()`: always the full string you set, even while an
  ellipsis trims it or a typewriter is halfway through. Likewise
  `.setFill("#color")` recolors and `.setFont(font)` swaps the face (both
  return `this`). Use `.setFill()` to animate/tint text color instead of
  faking it with a transparent `highlight` — e.g. `text.setFill(interpolateColors(...))`
  in `register()`.
- To resize after construction, call `.setFontSize(32)` — font size is a
  layout input, so it re-runs fit, clamp, and layout (unlike `.setFill()`).
  `.fontSize()` reads back the size the glyphs actually render at, so with
  `fitText` you get the fitted size rather than the one you asked for. Don't
  destroy and rebuild a node to change its size, and don't track the current
  size in composition state.
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
ellipsis: true,  // the default
trimBy: "word",  // "word" | "letter" — how overflow is cut before the ellipsis
```

`ellipsis` defaults to `true`, and truncation is silent: whenever the text
overflows its box (`wrap: "none"` with a width, `maxLines`, or a height), the
tail is cut and "…" appended, with no warning. A one-line label with no
`width` can hit this too, when its box was sized before the real webfont
loaded (see "Current limitations" in [layout.md](layout.md)); that's how a
handle label ships as "TEACHING ONLINE @…". For headlines and
labels, give an explicit `width` with room to spare and turn it off, so an
overflow shows up as visibly wrong instead of quietly shortened:

```ts
new Text({ text: "TEACHING ONLINE", width: 960, align: "center", wrap: "none", ellipsis: false, fontSize: 72 });
```

Keep `ellipsis` on only for copy that is allowed to be cut: body text from
props under `maxLines`.

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
});
```

Mutate the `HighlightConfig` object in place (as above). `Text` checks its
highlights every tick and repaints the marks on the same frame when one
changed, wherever the node sits, so there's no `setText()`, rebuild or
relayout call to make.

On `@smoove/core` 0.4.0 and earlier, a standalone `Text` (straight in a
`Sequence`, no `typewriter`, not in a `Flex`/`Block`) only repaints when told
to: call `node._layoutText()` right after mutating the highlight, inside
`register()`.

### Several highlights at once

`highlights` is an array, and every entry paints. To change the set (a new
caption line has different keywords), replace the whole array with
`setAttr("highlights", [...])`, and the marks repaint right away. Entries
paint in order, so the last one sits on top. A transparent
`background` plus a `color` recolors a run without a box:

```ts
const spoken: HighlightConfig = { start: 0, end: 0, background: "#FFD43B", color: "#0B0E14", paddingStart: 12, paddingEnd: 12, cornerRadiusStart: 14, cornerRadiusEnd: 14, progress: 1 };
const accents: HighlightConfig[] = [
  { start: 0, end: 5, background: "rgba(0,0,0,0)", color: "#FFD43B" }, // keyword in accent colour
];
caption.setAttr("highlights", [...accents, spoken]); // spoken box on top
```

## Recipe: word-by-word captions

The standard reel look: two to four words on screen, the word being spoken
boxed, the whole line outlined so it reads over any footage. Input is word
timings in output frames, `[{ text, from, to }]` (from a transcript, see
"Cues from data" in [sequencing.md](sequencing.md)).

```ts
import { Group, type HighlightConfig, interpolate, Text } from "@smoove/core";

type Word = { text: string; from: number; to: number };

// 1. Group 2-4 words; break on punctuation and on long lines.
function groupWords(words: Word[], maxWords = 3, maxChars = 16) {
  const groups: { words: Word[]; text: string; ranges: [number, number][]; from: number; to: number }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    let pos = 0;
    const ranges: [number, number][] = [];
    const text = cur.map((w) => { const t = w.text.toUpperCase(); ranges.push([pos, pos + t.length]); pos += t.length + 1; return t; }).join(" ");
    groups.push({ words: cur, text, ranges, from: cur[0].from, to: cur[cur.length - 1].to });
    cur = [];
  };
  for (const w of words) {
    const len = cur.map((x) => x.text).join(" ").length + w.text.length + 1;
    if (cur.length >= maxWords || (cur.length && len > maxChars)) flush();
    cur.push(w);
    if (/[.,!?]$/.test(w.text)) flush();
  }
  flush();
  return groups;
}

const groups = groupWords(words);
const root = new Group({ x: 540, y: 1500, listening: false });
seq.add(root);

// 2. Outline: eight dark offset copies behind the main text. Never
//    shadowBlur (see performance.md). `heavy` is a Font face, e.g.
//    montserrat.face("900") (fonts.md).
const opts = { text: " ", width: 1000, x: -500, y: -43, align: "center" as const, wrap: "none" as const, ellipsis: false, font: heavy, fontSize: 86 };
const copies = Array.from({ length: 8 }, (_, k) => {
  const a = (k / 8) * Math.PI * 2;
  return new Text({ ...opts, fill: "#0B0E14", x: opts.x + Math.cos(a) * 7, y: opts.y + Math.sin(a) * 7 });
});
const spoken: HighlightConfig = { start: 0, end: 0, background: "#FFD43B", color: "#0B0E14", paddingStart: 12, paddingEnd: 12, cornerRadiusStart: 14, cornerRadiusEnd: 14, progress: 0 };
const main = new Text({ ...opts, name: "caption", fill: "#FFFFFF", highlights: [spoken] });
root.add(...copies, main);

let shown: (typeof groups)[number] | undefined;
seq.register((frame) => {
  const g = groups.find((x) => frame >= x.from && frame < x.to);
  root.visible(!!g);
  if (!g) return;
  // Re-set the copy only when the group changes. `shown` caches a value
  // derived from the frame, so a seek still lands on the right text.
  if (g !== shown) {
    shown = g;
    for (const t of [...copies, main]) t.setText(g.text);
  }

  // 3. Pop the group in when it changes.
  const s = interpolate(frame, [g.from, g.from + 5], [0.8, 1], { extrapolateRight: "clamp" });
  root.scaleX(s);
  root.scaleY(s);

  // 4. Box the spoken word, sweeping the box on with `progress`.
  const wi = g.words.findLastIndex((w) => frame >= w.from);
  spoken.start = g.ranges[wi][0];
  spoken.end = g.ranges[wi][1];
  spoken.progress = interpolate(frame, [g.words[wi].from, g.words[wi].from + 2], [0, 1], { extrapolateRight: "clamp" });
});
```

Everything is derived from `frame` and the word list, so a seek lands on the
right group and the right box. Hold a group until the next one starts when
the gap is short (set `g.to = next.from` when the gap is under ~0.5s), or the
captions flicker between phrases. For accent-coloured keywords, swap
`[spoken]` for `[...accents, spoken]` with `setAttr("highlights", …)` inside
the `g !== shown` branch, as in "Several highlights at once" above.

## Fonts

`font: someFont` or `font: someFont.face("700")` (a `Font`/`FontFaceRef`)
overrides `fontFamily`/`fontStyle` and triggers an automatic re-layout once
the face finishes loading — see [fonts.md](fonts.md) for declaring a `Font`
or pulling one from `@smoove/google-fonts`.

See `rules/assets/text-typewriter.composition.ts` for typewriter + highlight
combined in one scene.
