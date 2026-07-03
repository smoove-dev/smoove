# @smoove/renderer

Headless video renderer for [smoove](https://smoove.dev). Turns a
`Composition` into an MP4 or WebM file from Node.

`renderComposition` walks the frame clock the same way the player does,
rasterizes each frame with [skia-canvas](https://skia-canvas.org), and
encodes the result with [Mediabunny](https://mediabunny.dev) in a single
in-process pass: no ffmpeg binary, no temp files. The composition you
preview in the browser is the file you ship.

## Install

```sh
pnpm add konva @smoove/core @smoove/renderer
```

`konva` and `@smoove/core` are peer dependencies
(`@smoove/transitions` is an optional peer). Node-only.

## Quick example

Import the `register` entry first. It installs the skia backend and the
Node media factories, so do this before you build the composition:

```ts
import "@smoove/renderer/register";
import { Composition, interpolate, Rect, Sequence } from "@smoove/core";
import { renderComposition } from "@smoove/renderer";

const comp = new Composition({ id: "out", fps: 60, durationInFrames: 120, width: 1280, height: 720 });

const main = new Sequence();
const box = new Rect({ x: 0, y: 320, width: 80, height: 80, fill: "#ffd166" });
main.add(box);
main.register((f) => box.x(interpolate(f, [0, 119], [0, 1200])));
comp.add(main);

await renderComposition(comp, { output: "out.mp4" });
```

Only `output` is required; everything else falls back to the composition's
own settings. Options include `resolution`, `fit`, `quality` presets,
`fps`, a frame `range`, `format` (`"mp4"` or `"webm"`), `mute`, `fonts`,
`onProgress`, and an `AbortSignal`. Single frames and raw frame streams are
also supported.

To render WebGL shader transitions headlessly, import `@smoove/renderer/gl`
before building the composition.

## Docs

Full documentation lives at [smoove.dev](https://smoove.dev).

## License

MIT
