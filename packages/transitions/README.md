# @smoove/transitions

Scene transitions for [smoove](https://smoove.dev) — blend one scene into
the next with cross-fades, slides, wipes, and WebGL shader effects.

A transition overlaps the end of one scene with the start of the next while
a **presentation** mixes them. You build them with `TransitionSeries`, which
plays scenes in order and overlaps each pair where they meet; `comp.add(series)`
expands the whole thing into one `Sequence` per scene.

## Install

```sh
pnpm add konva @smoove/core @smoove/transitions
```

`konva` and `@smoove/core` are peer dependencies.

## Quick example

```ts
import { Composition } from "@smoove/core";
import { fade, linearTiming, TransitionSeries } from "@smoove/transitions";

const comp = new Composition({ id: "intro", fps: 60, durationInFrames: 200, width: 1280, height: 720 });

const series = new TransitionSeries({ composition: comp });
series.scene({ durationInFrames: 80 }, (seq) => seq.add(sceneA));
series.transition({ presentation: fade(), timing: linearTiming({ durationInFrames: 20 }) });
series.scene({ durationInFrames: 80 }, (seq) => seq.add(sceneB));

comp.add(series);
```

## Presentations

**Geometric** — run on Konva transforms, work everywhere the player does and
render headlessly with no extra setup: `fade`, `slide`, `wipe`, `clockWipe`,
`iris`, `flip`, `none`.

**Shader** — run on WebGL2 fragment shaders in the browser and fall back to
`fade()` without it: `dissolve`, `crosswarp`, `crossZoom`, and more. To
render them headlessly, import `@smoove/renderer/gl` before building the
composition.

Two timings drive any presentation: `linearTiming` and `springTiming`.

## Docs

Full documentation, including the complete presentation catalog, lives at
[smoove.dev](https://smoove.dev).

## License

MIT
