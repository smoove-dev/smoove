# @smoove/lottie

Play Lottie animations on the smoove timeline.

A Lottie file carries its own frame rate and its own clock. This package hands
that clock to your composition instead: the animation advances because your
playhead moved, so it scrubs, seeks, and renders like every other node in the
scene.

```ts
import { Composition, Sequence } from "@smoove/core";
import { Lottie } from "@smoove/lottie";

const comp = new Composition({ id: "hero", fps: 30, durationInFrames: 90, width: 1280, height: 720 });
const main = new Sequence();

main.add(new Lottie({ src: "/checkmark.json", width: 240, height: 240 }));

comp.add(main);
export default comp;
```

## Install

```bash
pnpm add @smoove/lottie
```

`konva` and `@smoove/core` are peer dependencies, so your app pins the versions.

## Frame rate is resampled, not assumed

Give it a 24 fps animation on a 30 fps timeline and the node works out where
the animation should be at each of your frames, including the fractional
positions between its own. The two frame rates do not have to divide evenly, or
match at all.

The same math covers playback rate:

```ts
new Lottie({ src: "/spinner.json", width: 200, height: 200, speed: 0.5, loop: true });
```

## Picking part of the animation

`segment` takes a Lottie-frame range, and `marker` takes a name that the
animation already defines:

```ts
new Lottie({ src: "/logo.lottie", segment: [0, 24] });
new Lottie({ src: "/logo.lottie", marker: "intro" });
```

`trimBefore` and `trimAfter` are counted in composition frames, matching
`Image` and `Video`, so trimming works the same way across all of them.

## Sizing

Sizing, fit, and layout props are spelled the way the rest of smoove spells
them. Drop one into a `Flex` and it lays out like any other child:

```ts
new Lottie({
  src: "/burst.json",
  width: "50%",
  objectFit: "cover",
  objectPosition: "top",
  cornerRadius: 16,
});
```

Leave `width` and `height` off and the node takes the animation's authored
size.

## Loading

Pass a URL as `src`, or hand over the animation itself as `data`:

```ts
import burst from "./burst.json";

new Lottie({ data: burst, width: 300, height: 300 });
```

`data` accepts parsed JSON, a JSON string, or the bytes of a `.lottie` file.
Importing the JSON is worth preferring when you server-render, since there is
no URL to resolve at render time.

Either way the composition waits for the animation before it paints, so a
render never captures a half-loaded frame.

## Self-hosting the renderer

Drawing is done by a WebAssembly rasterizer, which the browser fetches from a
CDN by default. To serve it yourself, point the package at your own copy
before you build any node:

```ts
import wasmUrl from "@lottiefiles/dotlottie-web/dotlottie-player.wasm?url";
import { setLottieWasmUrl } from "@smoove/lottie";

setLottieWasmUrl(wasmUrl);
```

Node needs no setup. `@smoove/renderer` reads the file straight off disk, so
headless renders run without touching the network.

## What is not here

State machines, themes, and slots are outside what a frame renderer needs, and
Lottie interactivity has no meaning in a video frame. If you want one of them,
open an issue and say what you are building.
