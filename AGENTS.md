# AGENTS.md

Repo/engineering reference for any coding agent (Claude Code, Codex, Cursor,
etc.) working in this repo. This is the single source of truth — other
agent-instruction files (e.g. `CLAUDE.md`) point here rather than
duplicating it. Keep this file short and current.

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
packages/core         @smoove/core — engine + layout. Composition, Sequence, Series, Flex, Block, Image, Text, + a flex-aware wrapper for every Konva shape (Rect/Circle/Star/…). konva is a peerDep; flexily, bezier-easing, mediabunny are regular deps.
packages/player        @smoove/player — Lit web-component player wrapping a Composition (<smoove-player> + controls). konva + core are peerDeps; lit + @lit/context are deps. Light DOM; opt-in styles at "@smoove/player/styles.css".
packages/transitions   @smoove/transitions — Remotion-style TransitionSeries + 18 presentations + 2 timings for scene-to-scene cuts. konva + core are peerDeps.
packages/renderer      @smoove/renderer — headless video renderer (Node). Rasterizes a Composition with skia-canvas (konva/skia-backend) and encodes via Mediabunny (@mediabunny/server, i.e. node-av bindings to the FFmpeg C API — no ffmpeg CLI binary required). konva + core + transitions are peerDeps. `./register` subpath = setupServerRendering() at import.
packages/studio        @smoove/studio — composable React studio UI for smoove compositions: a `<Studio>` compound (Library/Sidebar, Stage, Timeline, SchemaForm props panel, RenderDialog/ExportFrameDialog/RenderQueue) plus a `defineRegistry()` DSL for declaring a composition catalog. konva, core, player, renderer, react, react-dom are peerDeps. This is what a now-removed `packages/timeline` placeholder was planned to become.
packages/google-fonts  @smoove/google-fonts — typed, tree-shakeable Google Fonts for smoove: one Font subclass per family, no-build (imported as TS source), wildcard subpath exports. core + konva are peerDeps.
packages/vite          @smoove/vite — Vite plugin for smoove studio: invisible HMR wiring + build-time composition metadata. vite is a peerDep.
packages/docs          @smoove/docs — the documentation website. React Router 7 framework-mode SSR app on **Fumadocs** (fumadocs-core/fumadocs-ui/fumadocs-mdx). Content is `.mdx` under `content/docs/`, sidebar order/grouping via per-folder `meta.json`. Embeds live `<smoove-player>` demos via a custom `<Demo name="..." />` MDX component (src/demos/*.ts). Dev server on :5176.
demo                   The studio reference app — Vite + React Router, imports packages via `workspace:*`. Wraps `@smoove/studio`'s `<Studio>` around a registry of ~30 compositions (demo/src/registry.ts, defineRegistry()), with real routes (`/`, `/c/:id`, `/queue` — not hash routing) and a server-side render queue (demo/src/server/render-queue.server.ts + `/api/render*` SSE-driven jobs) backed by @smoove/renderer.
doc                    Design + usage docs, including doc/README.md (full API guide) and doc/smoove-brand-brief.md (voice, positioning, visual direction).
skills/smoove-video    Agent skill teaching an LLM how to author a smoove Composition/Sequence — timeline scenes, Flex/Block layout, interpolate-based animation, Text/shape authoring. The concrete proof point of the brand's "LLM-authorable" pillar.
```

Top-level `tsconfig.json` is a solution file; per-package `tsconfig.json` uses
`composite: true` with project references.

`core/src` is grouped by domain: `engine/` (composition, sequence, series,
signal, emitter, environment), `layout/` (block, image, `shapes`, `contract`,
`flex/`, `text/`), `animation/` (interpolate, interpolate-colors, color,
easing), and `media/` (media-time, media-marker, `audio/`, `video/`).
`index.ts` is the single public barrel — the package only exports `.`, so
consumers never deep-import; internal moves just need the barrel repointed.

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
- **`@smoove/studio` is the reusable UI layer**; the `demo` app is just a
  registry + routing shell around it. Don't put studio-shaped UI logic
  directly in `demo/` if it belongs in the package — new studio panels,
  dialogs, or hooks go in `packages/studio/src`.
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
| `pnpm dev` | Studio reference app (Vite + React Router) |
| `pnpm dev:docs` | Fumadocs docs site at http://localhost:5176 |
| `pnpm build` | Build all `packages/*` |
| `pnpm check` | Biome lint + format check |
| `pnpm format` | Biome auto-format |
| `pnpm --filter @smoove/studio dev` | tsc watch for one package (swap the package name) |

The demo imports each package's **built** entry (not source), so after editing
`packages/*/src` you need a `pnpm build` (or a `tsc -b --watch` running in the
package) before the change is visible in the demo.

## Gotchas

- Vite + workspace symlinks resolve `@smoove/*` automatically — no
  `resolve.alias` needed. Don't add one.
- The demo's `tsconfig.json` uses `noEmit: true` and `composite: false`; it's
  for typechecking only. Vite handles the actual build.
- If you change package public API, update `doc/README.md` so the target API
  example stays accurate.
