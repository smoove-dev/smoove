# @smoove/code

Animated, syntax-highlighted source code for smoove. `Code` is a timeline node
like `Text`: it renders highlighted code and morphs between snapshots with a
per-token diff, all as a pure function of the frame.

## Install

```bash
pnpm add @smoove/code
```

Bring a Lezer parser for the language you want to highlight:

```bash
pnpm add @lezer/javascript
```

## Usage

```ts
import { Code, interpolateCode, LezerHighlighter } from "@smoove/code";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";
import { parser } from "@lezer/javascript";

const highlighter = new LezerHighlighter(parser);
const font = new JetBrainsMono({ weights: ["400"] });

const code = new Code({
  x: 32,
  y: 200,
  content: `const number = 7;`,
  highlighter,
  font,
  fontSize: 24,
});
seq.add(font); // register the font so preview and render both have the glyphs
seq.add(code);

seq.register((f) => {
  code.setContent(
    interpolateCode(f, [0, 60], [
      `const number = 7;`,
      `const number = createSignal(7);`,
    ]),
  );
});
```

`interpolateCode` reads the frame and returns what the node should show;
`setContent` renders it. Unchanged code stays put while the parts that differ
cross-fade.

## Customize

- Theme: pass a `HighlightStyle` as the second argument to `LezerHighlighter`.
  Presets ship in the box: `nordDark` (default), `nordLight`, `dracula`,
  `githubLight`, plus `makeHighlightStyle` to build your own.
- Language: pass any `@lezer/*` parser (JavaScript, Python, CSS, and so on).
- Font: set `font` to a smoove `Font` (a monospace face keeps columns aligned),
  plus `fontSize` and `lineHeight`.
- Selection: dim everything except a range with `setSelection` and animate it
  with `interpolateSelection`.
- Edits: target a range with `interpolateEdit` and `insert` / `remove` /
  `replace` instead of diffing whole strings.

## Docs

Full guide, theming, and the API: https://smoove.dev/docs/code

## License

MIT
