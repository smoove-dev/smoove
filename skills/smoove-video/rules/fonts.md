# Fonts

## `Font` — declarative custom/local fonts (always available, `@smoove/core`)

```ts
import { Block, Font, Text } from "@smoove/core";

const lora = new Font({
  family: "Lora",                 // process-global — distinct fonts need distinct names
  faces: [
    { weight: 400, style: "normal", src: loraRegularUrl }, // a Vite `?url` import, or a remote URL
    { weight: 400, style: "italic", src: loraItalicUrl },
    { weight: 700, style: "normal", src: loraBoldUrl },
  ],
});

main.add(lora); // register it with the sequence so the comp buffers on load before playing

col.add(new Text({ font: lora, text: "Preferred face (400/normal)", fontSize: 22 }));
col.add(new Text({ font: lora.face("700"), text: "Bold face", fontSize: 22 }));
col.add(new Text({ font: lora.face("400-italic"), text: "Italic face", fontSize: 18 }));
```

`font` on `Text` overrides `fontFamily`/`fontStyle` and re-lays-out
automatically once the face loads. `.face(selector)` picks a specific
declared face (`"<weight>"` or `"<weight>-<style>"`); a bare `Font` uses its
preferred face (400/normal, else the first declared).

## `@smoove/google-fonts` (optional install)

Not installed by default — `pnpm add @smoove/google-fonts` for typed,
no-build access to the full Google Fonts catalog without manually sourcing
`.woff2` URLs. Each family is its own subpath export (tree-shakeable) and a
subclass of core's `Font`, so `.face()` and the buffering gate work
unchanged:

```ts
import Roboto from "@smoove/google-fonts/roboto";
import PlayfairDisplay from "@smoove/google-fonts/playfair-display";

const roboto = new Roboto({ weights: ["400", "700"] });               // omit weights/styles → all
const playfair = new PlayfairDisplay({ weights: ["400", "700"], styles: ["normal", "italic"] });

main.add(roboto, playfair); // same registration as a plain Font

col.add(new Text({ font: roboto, text: "Roboto", fontSize: 22 }));
col.add(new Text({ font: playfair.face("700"), text: "Playfair Display", fontSize: 36 }));
col.add(new Text({ font: playfair.face("400-italic"), text: "in italic", fontSize: 20 }));
```

`weights`/`styles` are typed per-family (literal unions of what that family
actually ships) — your editor will autocomplete the valid set. `subset`
(default `"latin"`) picks the character set; pick the subset matching your
text so the same file loads in-browser and in headless/server rendering.

See `demo/src/compositions/custom-font/composition.ts` (declarative `Font`)
and `demo/src/compositions/google-font/composition.ts` (four
`@smoove/google-fonts` families in one card) for full working scenes.
