# CLAUDE.md

Notes for Claude Code working in this repo. Keep this file short and current.

## What this repo is

`konva-motion` brings Remotion-style timeline-driven animation to
[Konva](https://konvajs.org). The mental model: `Composition extends
Konva.Stage` owns a frame clock (fps + durationInFrames); `Sequence extends
Konva.Layer` is a range-gated layer — visible and `batchDraw`'d only while
the playhead is in `[from, from + durationInFrames)`. Each tick the
composition walks its child sequences, runs their updaters, and issues one
`batchDraw()` per active sequence.

## Layout

```
packages/core       @konva-motion/core — engine + layout. Composition, Sequence, Flex, Block, Image. konva is a peerDep; flexily is a regular dep.
packages/timeline   @konva-motion/timeline — planned React UI components (scrubber, play button). Placeholder.
packages/player     @konva-motion/player — Lit web-component player wrapping a Composition (<km-player> + controls). konva + core are peerDeps; lit + @lit/context are deps. Light DOM; opt-in styles at "@konva-motion/player/styles.css".
packages/transitions @konva-motion/transitions — Remotion-style TransitionSeries + presentations. konva + core are peerDeps.
packages/renderer   @konva-motion/renderer — headless video renderer (Node). Rasterizes a Composition with skia-canvas (konva/skia-backend) and encodes via ffmpeg (@ffmpeg-installer). konva 10 + core are peerDeps; skia-canvas + @ffmpeg-installer are deps. `./register` subpath = setupServerRendering() at import.
demo                Vite + TS app, imports packages via `workspace:*`
doc                 short design + usage docs
```

Top-level `tsconfig.json` is a solution file; per-package `tsconfig.json` uses
`composite: true` with project references.

`core/src` is grouped by domain: `engine/` (composition, sequence, signal,
emitter, environment), `layout/` (block, image, `flex/`, `text/`), `animation/`
(interpolate, interpolate-colors, color, easing), and `media/` (media-time,
media-marker, `audio/`, `video/`). `index.ts` is the single public barrel — the
package only exports `.`, so consumers never deep-import; internal moves just
need the barrel repointed.

## Conventions

- **pnpm workspaces.** Cross-package deps use `workspace:*`. Don't add a
  package outside `packages/*` or `demo/` without updating `pnpm-workspace.yaml`.
- **`core` extends Konva classes.** `Composition extends Konva.Stage`,
  `Sequence extends Konva.Layer`, `Flex`/`Block`/`Image` extend `Konva.Group`.
  `konva` is a peer dep of `core`, not a regular dep — consumers pin the
  version. The demo pins a real `konva` version.
- **Layout is built in.** `Flex`/`Block`/`Image` use flexily (synchronous JS
  flexbox; no WASM/async init). `Sequence._apply` recomputes layout on any
  top-level `Flex` child each tick, so animated sizes/gaps reflow without
  user wiring.
- **Agnostic runtime.** `core` reads `requestAnimationFrame` /
  `cancelAnimationFrame` / `performance.now()` off `globalThis` with
  fallbacks — importing in Node is safe. `play()` throws in non-browser;
  `setFrame(n)` works anywhere for offline / server rendering.
- **`timeline` is a placeholder** for React UI components. Don't put engine
  logic there.
- **Build = `tsc -b` per package.** No bundler yet. Emit goes to `dist/`;
  packages publish via the `exports` field pointing at `dist/`.
- **Biome** for lint + format (`pnpm check`, `pnpm format`). Config is at the
  repo root; there is no per-package Biome config.
- **No tests yet.** Add Vitest per-package when there's logic worth testing —
  don't scaffold it preemptively.

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite demo at http://localhost:5173 |
| `pnpm build` | Build all `packages/*` |
| `pnpm check` | Biome lint + format check |
| `pnpm format` | Biome auto-format |
| `pnpm --filter @konva-motion/timeline dev` | tsc watch for one package |

The demo imports the package's **built** entry (not source), so after editing
`packages/*/src` you need a `pnpm build` (or a `tsc -b --watch` running in the
package) before the change is visible in the demo.

## Gotchas

- Vite + workspace symlinks resolve `@konva-motion/*` automatically — no
  `resolve.alias` needed. Don't add one.
- The demo's `tsconfig.json` uses `noEmit: true` and `composite: false`; it's
  for typechecking only. Vite handles the actual build.
- If you change package public API, update `doc/README.md` so the target API
  example stays accurate.
