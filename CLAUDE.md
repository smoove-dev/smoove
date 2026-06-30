# CLAUDE.md

Notes for Claude Code working in this repo. Keep this file short and current.

## What this repo is

`smoove` brings Remotion-style timeline-driven animation to
[Konva](https://konvajs.org). The mental model: `Composition extends
Konva.Stage` owns a frame clock (fps + durationInFrames); `Sequence extends
Konva.Layer` is a range-gated layer — visible and `batchDraw`'d only while
the playhead is in `[from, from + durationInFrames)`. Each tick the
composition walks its child sequences, runs their updaters, and issues one
`batchDraw()` per active sequence.

## Layout

```
packages/core       @smoove/core — engine + layout. Composition, Sequence, Flex, Block, Image, Text, + a flex-aware wrapper for every Konva shape (Rect/Circle/Star/…). konva is a peerDep; flexily is a regular dep.
packages/timeline   @smoove/timeline — planned React UI components (scrubber, play button). Placeholder.
packages/player     @smoove/player — Lit web-component player wrapping a Composition (<smoove-player> + controls). konva + core are peerDeps; lit + @lit/context are deps. Light DOM; opt-in styles at "@smoove/player/styles.css". Built with **Vite** (not tsc): default mode emits `dist/player.js` (ESM, peers external) + types; `--mode standalone` emits `dist/player.global.js` (self-contained ESM for `<script type="module">`, bundles konva/core/lit and pins `window.Smoove` + `window.Konva`) via the `"./standalone"` / unpkg / jsdelivr export. CSS extracts to `dist/player.css`.
packages/transitions @smoove/transitions — Remotion-style TransitionSeries + presentations. konva + core are peerDeps.
packages/renderer   @smoove/renderer — headless video renderer (Node). Rasterizes a Composition with skia-canvas (konva/skia-backend) and encodes via ffmpeg (@ffmpeg-installer). konva 10 + core are peerDeps; skia-canvas + @ffmpeg-installer are deps. `./register` subpath = setupServerRendering() at import. `./gl` subpath = wire shader (Tier B) transitions through a headless-gl + skia compositor (optional `gl` dep; transitions optional peer) so they render server-side instead of falling back to fade.
packages/docs       @smoove/docs — documentation website. React Router framework-mode SSR app (RR 7, `appDirectory: "src"`). Renders Markdown pages (frontmatter via gray-matter, markdown-it + highlight.js) with the KmStudio design. Authoring = add a `.md` under `src/content/`; the sidebar nav, TOC, and prev/next are derived from frontmatter. Embeds live demos via @smoove/player.
demo                Vite + TS app, imports packages via `workspace:*`
doc                 short design + usage docs
```

Top-level `tsconfig.json` is a solution file; per-package `tsconfig.json` uses
`composite: true` with project references.

`core/src` is grouped by domain: `engine/` (composition, sequence, signal,
emitter, environment), `layout/` (block, image, `shapes`, `contract`, `flex/`,
`text/`), `animation/` (interpolate, interpolate-colors, color, easing), and
`media/` (media-time, media-marker, `audio/`, `video/`). `index.ts` is the
single public barrel — the package only exports `.`, so consumers never
deep-import; internal moves just need the barrel repointed.

## Conventions

- **pnpm workspaces.** Cross-package deps use `workspace:*`. Don't add a
  package outside `packages/*` or `demo/` without updating `pnpm-workspace.yaml`.
- **`core` extends Konva classes.** `Composition extends Konva.Stage`,
  `Sequence extends Konva.Layer`, `Flex`/`Block`/`Image`/`Text` extend
  `Konva.Group`, and each shape wrapper extends its `Konva.Shape` (via the
  `FlexShape` mixin in `layout/flex/mixin.ts`). `konva` is a peer dep of `core`,
  not a regular dep — consumers pin the version. The demo pins a real `konva`
  version. Aim: an app imports the whole drawing vocabulary from core, not
  `Konva.*`.
- **Layout is built in.** Wrappers use flexily (synchronous JS flexbox; no
  WASM/async init). `Sequence._apply` recomputes layout on any top-level `Flex`
  or `Block` child each tick, so animated sizes/gaps reflow without user wiring.
- **Layout dispatch is an open contract**, not an `instanceof` switch. Nodes
  implement `KMLayoutNode` (`layout/contract.ts`: `_kmRole`, `_kmMeasure?`,
  `_kmPlace`, `_kmComputeLayout?`); `flex.ts`/`sequence.ts` dispatch via
  `isKMLayoutNode`/`isKMLayoutRoot`. Wrap a new node type by implementing the
  contract — don't edit the engine. Shape wrappers use `getSelfRect()` for
  intrinsic size + origin-corrected placement; their config translator must
  *delete* (not `undefined`) absent width/height so `Circle`-style radius attrs
  aren't wiped.
- **Agnostic runtime.** `core` reads `requestAnimationFrame` /
  `cancelAnimationFrame` / `performance.now()` off `globalThis` with
  fallbacks — importing in Node is safe. `play()` throws in non-browser;
  `setFrame(n)` works anywhere for offline / server rendering.
- **`timeline` is a placeholder** for React UI components. Don't put engine
  logic there.
- **Build = `tsc -b` per package**, _except_ `player`, which builds with
  **Vite** (library mode + vite-plugin-dts) so it can also ship a
  self-contained `<script>`-tag bundle. Emit goes to `dist/`; packages publish
  via the `exports` field pointing at `dist/`. Because player no longer emits
  via tsc, it is **not** a project-reference of other packages (studio/docs/root
  tsconfigs reference core/renderer only) — consumers resolve player types
  through its `types` field.
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
| `pnpm --filter @smoove/timeline dev` | tsc watch for one package |

The demo imports the package's **built** entry (not source), so after editing
`packages/*/src` you need a `pnpm build` (or a `tsc -b --watch` running in the
package) before the change is visible in the demo.

## Gotchas

- Vite + workspace symlinks resolve `@smoove/*` automatically — no
  `resolve.alias` needed. Don't add one.
- The demo's `tsconfig.json` uses `noEmit: true` and `composite: false`; it's
  for typechecking only. Vite handles the actual build.
- If you change package public API, update `doc/README.md` so the target API
  example stays accurate.
