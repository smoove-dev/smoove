<p align="center">
  <img src="./assets/smoove-mark.svg" alt="smoove" width="96" height="96">
</p>

<h1 align="center">
  smoove
  <small align="center"><strong>Smooth moves, in code.</strong></small>
</h1>

<p align="center">
  A timeline-driven animation engine for <a href="https://konvajs.org">Konva</a>.
  Keyframe motion that runs anywhere, renders fast, and is built on concepts
  an LLM can reason about to author videos.
</p>

<p align="center">Smooth · Light · Anywhere</p>

<hr />

A **Composition** is a `Konva.Stage` that owns a frame clock. A **Sequence**
is a `Konva.Layer` scoped to a frame range: its updaters run and its layer
paints only while playback is inside that range. Composition issues one
`batchDraw()` per active sequence per frame.

```ts
import { Composition, Sequence } from "@smoove/core";
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

| Package                                           | What it is                                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@smoove/core`](./packages/core)                 | Engine and layout: `Composition`, `Sequence`, `Series`, `Flex`/`Block`/`Text`/`Image`, plus flex-aware Konva shape wrappers. `konva` is a peer dep. |
| [`@smoove/player`](./packages/player)             | Lit web-component player (`<smoove-player>`) that plays a `Composition` like an HTML5 `<video>`.                                                    |
| [`@smoove/transitions`](./packages/transitions)   | Remotion-style `TransitionSeries` with 18 presentations and 2 timings for scene-to-scene cuts.                                                      |
| [`@smoove/renderer`](./packages/renderer)         | Headless server renderer. Rasterizes with skia-canvas and encodes via Mediabunny, no ffmpeg binary needed.                                          |
| [`@smoove/studio`](./packages/studio)             | Composable React studio UI: catalog, stage, timeline, props form, and render dialogs.                                                               |
| [`@smoove/google-fonts`](./packages/google-fonts) | Typed, tree-shakeable Google Fonts for `Text`'s `font` prop.                                                                                        |
| [`@smoove/vite`](./packages/vite)                 | Vite plugin for smoove studio: HMR wiring plus build-time composition metadata.                                                                     |
| [`@smoove/docs`](./packages/docs)                 | The documentation website (Fumadocs + React Router).                                                                                                |

## Quick start

```sh
pnpm install
pnpm dev          # studio reference app at http://localhost:5174
pnpm dev:docs     # docs site at http://localhost:5176
pnpm build        # build all packages
pnpm check        # Biome lint + format check
```

The studio reference app (`demo/`) registers about 30 example compositions
(basic shapes, easing races, flex layout, text effects, audio/video sync,
transitions) in a searchable library, with a live stage, a timeline, and a
server-side render queue for exporting to video.

## Built for agents too

smoove's API is built on concepts an LLM already knows: keyframes,
timelines, flexbox layout, familiar shape primitives. That means a model
can reason from the docs and produce a correct `Composition` on the first
try. See [`skills/smoove-video`](./skills/smoove-video) for the agent skill
that teaches Claude Code (or any coding agent) how to author one.

## Docs

- [Usage & API](./doc/README.md)
- [Architecture](./doc/architecture.md)
- [Contributing](./doc/contributing.md)

## License

MIT
