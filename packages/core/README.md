# @smoove/core

A timeline-driven animation engine for [Konva](https://konvajs.org) —
keyframe motion that runs anywhere: buttery in the browser, headless on the
server.

A **Composition** is a `Konva.Stage` that owns a frame clock (fps +
duration). A **Sequence** is a `Konva.Layer` scoped to a frame range: its
updaters run and its layer paints only while the playhead is in range. The
engine is agnostic — `play()` uses `requestAnimationFrame` in the browser;
on the server, step frames manually with `setFrame(n)` for offline
rendering.

Core also ships a built-in flexbox layout system (`Flex`, `Block`), a
rich `Text` node, `Image`/`Video`/`Audio` media nodes, `interpolate` +
`Easing` animation helpers, and a flex-aware wrapper for every Konva shape
(`Rect`, `Circle`, `Star`, ...) — so an app imports its whole drawing
vocabulary from one place.

## Install

```sh
pnpm add @smoove/core konva
```

`konva` is a peer dependency, so you pin the version. The package is
ESM-only.

## Quick example

```ts
import { Circle, Composition, Easing, interpolate, Sequence } from "@smoove/core";

const comp = new Composition({
  id: "main",
  fps: 30,
  durationInFrames: 300,
  container: "root",
  width: 800,
  height: 600,
});

// A sequence covering the whole composition, like a "root" layer.
const main = new Sequence({ from: 0, durationInFrames: 300 });
const circle = new Circle({ x: 100, y: 300, radius: 40, fill: "tomato" });
main.add(circle);
comp.add(main);

main.register((frame) => {
  circle.x(interpolate(frame, [0, 300], [100, 700], { easing: Easing.inOut(Easing.quad) }));
});

// A sequence with its own layer, only painted while in range.
const flash = new Sequence({ from: 90, durationInFrames: 60 });
comp.add(flash);
flash.register((localFrame) => {
  flash.opacity(1 - localFrame / 60);
});

comp.play();
```

Chain scenes back-to-back with `Series`, and overlap them with cross-fades,
wipes, and WebGL shader transitions via
[`@smoove/transitions`](https://www.npmjs.com/package/@smoove/transitions).

## Ecosystem

- [`@smoove/player`](https://www.npmjs.com/package/@smoove/player) — `<smoove-player>` web-component player with controls
- [`@smoove/transitions`](https://www.npmjs.com/package/@smoove/transitions) — `TransitionSeries` scene transitions: cross-fades, wipes, shader effects
- [`@smoove/renderer`](https://www.npmjs.com/package/@smoove/renderer) — headless Node video renderer (skia-canvas + Mediabunny)
- [`@smoove/studio`](https://www.npmjs.com/package/@smoove/studio) — composable React studio UI
- [`@smoove/google-fonts`](https://www.npmjs.com/package/@smoove/google-fonts) — typed, tree-shakeable Google Fonts
- [`@smoove/vite`](https://www.npmjs.com/package/@smoove/vite) — Vite plugin for the studio

## Docs

Full documentation lives at [smoove.dev](https://smoove.dev).

## License

MIT
