# konva-motion

Remotion-style timeline-driven animation for [Konva](https://konvajs.org).

A **Composition** is a `Konva.Stage` that owns a frame clock. A **Sequence**
is a `Konva.Layer` scoped to a frame range — its updaters run and its layer
paints only while in range. Composition issues one `batchDraw()` per active
sequence per frame.

```ts
import { Composition, Sequence } from "@konva-motion/core";
import Konva from "konva";

const comp = new Composition({
  id: "main",
  fps: 30,
  durationInFrames: 300,
  container: "root",
  width: 800,
  height: 600,
});

const main = new Sequence({ from: 0, durationInFrames: 300 });
const circle = new Konva.Circle({ x: 100, y: 300, radius: 40, fill: "tomato" });
main.add(circle);
comp.add(main);
main.register((f) => circle.x(100 + f * 2));

comp.play();
```

## Packages

| Package | What it is |
| --- | --- |
| [`@konva-motion/core`](./packages/core) | Engine — `Composition`, `Sequence`. `konva` is a peer dep. |
| [`@konva-motion/layout`](./packages/layout) | Flexbox (Yoga) layout for Konva groups, with optional Sequence integration. |
| [`@konva-motion/timeline`](./packages/timeline) | Planned home for React UI components (scrubber, play button). Placeholder. |

Pass `loop: true` to wrap playback at the end. Use `comp.setFrame(n)` to
scrub (works on the server too — `play()` is browser-only).

## Quick start

```sh
pnpm install
pnpm dev          # Vite demo at http://localhost:5173
pnpm build        # build all packages
pnpm check        # Biome lint + format check
```

The demo ships with four examples (basic, bouncing-ball loop, staggered
fade-in, rotate+scale) and a draggable timeline scrubber.

## Docs

- [Usage & API](./doc/README.md)
- [Architecture](./doc/architecture.md)
- [Contributing](./doc/contributing.md)

## License

MIT
