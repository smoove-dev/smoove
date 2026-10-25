# AGENTS.md

Repo/engineering reference for any coding agent (Claude Code, Codex, Cursor,
etc.) working in this repo. This is the single source of truth. Other
agent-instruction files (e.g. `CLAUDE.md`) point here instead of
duplicating it. Keep this file short and current.

## What this repo is

`smoove` brings Remotion-style timeline-driven animation to
[Konva](https://konvajs.org). The mental model: `Composition extends
Konva.Stage` owns a frame clock (fps + durationInFrames); `Sequence extends
Konva.Layer` is a range-gated layer, visible and `batchDraw`'d only while
the playhead is in `[from, from + durationInFrames)`. Each tick the
composition walks its child sequences, runs their updaters, and issues one
`batchDraw()` per active sequence.

## Layout

```
packages/core         @smoove/core: engine and layout. Composition, Sequence, Series, Flex, Block, Image, Text, plus a flex-aware wrapper for every Konva shape (Rect/Circle/Star/...). konva is a peerDep; flexily, bezier-easing, and mediabunny are regular deps.
packages/player        @smoove/player: Lit web-component player wrapping a Composition (<smoove-player> plus controls). konva and core are peerDeps; lit and @lit/context are deps. Light DOM, with opt-in styles at "@smoove/player/styles.css".
packages/transitions   @smoove/transitions: Remotion-style TransitionSeries with 18 presentations and 2 timings for scene-to-scene cuts. konva and core are peerDeps.
packages/effects       @smoove/effects: visual effects for smoove. `flameWrap` wraps animated fire around a node via a single-pass fragment shader — its rounded box by default, or its alpha silhouette (`shape: "silhouette"`, over a cached signed distance field) so a burning `Text` burns letter by letter. `droplets` rains on the glass in front of a node, and `chromaKey` keys a colour out of a clip (chroma distance normalized by the key colour's own saturation, plus despill and a spatial choke). The pipeline itself (the `effects` attr, capture/pass/blit, dirty tracking) lives in core/src/effects; this package holds the presets. konva and core are peerDeps.
packages/renderer      @smoove/renderer: headless video renderer (Node). Rasterizes a Composition with skia-canvas (konva's skia backend) and encodes via Mediabunny (@mediabunny/server, i.e. node-av bindings to the FFmpeg C API, so no ffmpeg CLI binary is required). konva, core, and transitions are peerDeps. The `./register` subpath calls setupServerRendering() at import.
packages/studio        @smoove/studio: composable React studio UI for smoove compositions. A `<Studio>` compound (Library/Sidebar, Stage, Timeline, SchemaForm props panel, RenderDialog/ExportFrameDialog/RenderQueue) plus a `defineRegistry()` DSL for declaring a composition catalog. It also ships the ready-made studio app new projects run: `template/app/` (React Router routes, layout, render API), `template/detached/` (the configs `smoove studio detach` writes), `./preset` (sync the app into a project's gitignored `.smoove/studio/` and run, build, serve, test or detach it) and `./vite` (`smooveStudio()`: finds `compositions/*/index.ts` into `virtual:smoove/registry.ts`, serves `smoove.config.ts` as `virtual:smoove/config`, and carries the app's Vite settings). konva, core, player, renderer, react, and react-dom are peerDeps. This is what a now-removed `packages/timeline` placeholder was originally meant to become.
packages/lottie        @smoove/lottie: timeline-driven Lottie animations. A frame-pure `Lottie` node that maps composition frames onto the animation's own frame rate (resampling between them) and rasterizes via @lottiefiles/dotlottie-web (ThorVG/WASM) into a DOM-free surface, so preview and headless render share one rasterizer. konva is a peerDep; core and dotlottie-web are deps. The wasm is CDN-fetched in the browser (override with `setLottieWasmUrl`) and inlined as a `data:` URL in Node, because Node's fetch rejects `file://`.
packages/google-fonts  @smoove/google-fonts: typed, tree-shakeable Google Fonts for smoove. One Font subclass per family, no build step (imported as TS source), wildcard subpath exports. core and konva are peerDeps.
packages/vite          @smoove/vite: Vite plugin for smoove studio. Invisible HMR wiring plus build-time composition metadata, and in dev it mounts the @smoove/agent bridge (`agent: false` turns it off; `root` names the project root when it isn't Vite's). vite is a peerDep.
packages/agent         @smoove/agent: the bridge between a coding agent and the studio. Main entry is the shared message types, error codes and beat helpers (no runtime deps); `./server` is the dev-server half (token-guarded `/__smoove/agent/{status,seek,snapshot,sheet,timeline,render}`, routing by composition to a user tab or to the bridge's own headless Chrome, `.smoove/agent.json` discovery file, PNGs under `.smoove/snaps/` and `.smoove/sheets/`); `./client` connects a browser tab over an event stream and answers with handlers it is given. The studio's handlers live in packages/studio/src/agent. Siblings take it as a regular dep, never a peer. Its main entry also holds the media tools' result types and paths (`.smoove/media/`, `footage/`, `transcripts/`, `assets/credits.json`), and `./server` has `captureScreenshot`, a page screenshot from the installed Chrome. Vitest tests use fake tabs and a fake browser launcher, no real browser.
packages/cli           @smoove/cli: the `smoove` bin. Top level for people (`start` [--prod], `build`, `new`, `render`, `test`), `smoove agent <cmd>` for agents (start, stop, status, seek, snap, sheet, timeline, context, check, render_status, mcp), and `smoove studio detach`. One command table (src/commands.ts) drives both the command line and the MCP tools (src/mcp); the purity lint lives in src/lint. The media tools for long footage (`footage_add`, `media_info`, `media_audio`, `media_video`, `media_sheet`, `extract_audio`, `transcribe`, `models`, `cut_plan`, `media_status`) live in src/media, src/transcribe and src/cuts, and run in the CLI process on Mediabunny with `@mediabunny/server` (no ffmpeg binary), loaded lazily; local transcription is NVIDIA Parakeet on sherpa-onnx-node, installed on request into `~/.cache/smoove`. The asset tools (`asset_search` on Openverse, `asset_add`, `assets`, `page_shot`) live in src/assets. `smoove new --template recut` writes a composition that plays ranges of the original footage from its `cuts.json`; footage is never cut. Depends on @smoove/agent, @smoove/media and @smoove/studio.
packages/create        create-smoove: the `npm create smoove` scaffolding CLI. Fetches a template from gh:smoove-dev/smoove/templates at run time (giget), patches the name, offers install + `npx skills add smoove-dev/smoove -s smoove-video`. Unscoped on purpose — npm's create shorthand requires `create-<name>`. SMOOVE_CREATE_TEMPLATE_DIR=<path to templates/> scaffolds from a local checkout instead.
packages/docs          @smoove/docs: the documentation website. A React Router 7 framework-mode SSR app on **Fumadocs** (fumadocs-core/fumadocs-ui/fumadocs-mdx). Content is `.mdx` under `content/docs/`, with sidebar order and grouping via per-folder `meta.json`. Embeds live `<smoove-player>` demos through a custom `<Demo name="..." />` MDX component (src/demos/*.ts). Dev server runs on :5176.
packages/kitchen-sink  @smoove/kitchen-sink: the studio reference app (private, not published). Vite plus React Router; imports packages via `workspace:*` (built `dist/`, so `pnpm build` or a per-package `tsc -b --watch` before edits show up). Wraps `@smoove/studio`'s `<Studio>` around a registry of about 30 compositions (packages/kitchen-sink/src/registry.ts, defineRegistry()), with real routes (`/`, `/c/:id`, `/queue`, not hash routing) and a server-side render queue (packages/kitchen-sink/src/server/render-queue.server.ts plus `/api/render*` SSE-driven jobs) backed by @smoove/renderer.
templates              Standalone starter apps served by create-smoove: `studio` (a slim project: `compositions/`, `smoove.config.ts`, `package.json`; the studio app itself ships in @smoove/studio) and `composition-ts`/`composition-js` (minimal Vite + <smoove-player>). NOT in the pnpm workspace — they depend on published @smoove/* versions so a raw GitHub fetch installs cleanly. The sample composition is single-sourced in templates/shared/composition.ts (not a template — never fetched): edit it there (keep it free of TS-only syntax) and run `pnpm sync:templates` to copy it into all three; scripts/smoke-create.sh fails on drift and verifies all three build.
doc                    Design and usage docs, including doc/README.md (full API guide) and doc/smoove-brand-brief.md (voice, positioning, visual direction).
skills/smoove-video    Agent skill that teaches an LLM how to author a smoove Composition/Sequence (timeline scenes, Flex/Block layout, interpolate-based animation, Text/shape authoring). The concrete proof point of the brand's "LLM-authorable" pillar.
skills/smoove-writing  Agent skill for writing smoove prose (READMEs, docs pages, package descriptions, announcements). Self-contained: inlines the brand voice (originally from doc/smoove-brand-brief.md), hard human-style rules (no em dashes or other LLM-sounding tells), and a three-stage co-authoring workflow (context gathering, section-by-section drafting, zero-context reader testing) for longer docs.
skills/smoove-effects  Agent skill for authoring an effect in `@smoove/effects` or touching the pipeline in `core/src/effects`. Encodes the rules each of which was a real bug: frame purity from `fc.time`, the GLSL-ES-1.00-safe subset headless-gl needs, cost tracking the padded region's area, caching derived data on `fc.contentVersion` on a CPU-pinned surface, and the near/far distance-field ranges. Insists on verifying a thin shape and a big shape, in the browser and in a render.
```

Top-level `tsconfig.json` is a solution file; per-package `tsconfig.json` uses
`composite: true` with project references.

`core/src` is grouped by domain: `engine/` (composition, sequence, series,
signal, emitter, environment), `layout/` (block, image, `shapes`, `contract`,
`flex/`, `text/`), `animation/` (interpolate, interpolate-colors, color,
easing), and `media/` (media-time, media-marker, `audio/`, `video/`).
`index.ts` is the single public barrel. The package only exports `.`, so
consumers never deep-import; internal moves just need the barrel repointed.

## Conventions

- **NEVER COMMIT.** Do not run `git commit` (or push) unless explicitly asked,
  even if a skill or workflow says to. Leave changes in the working tree.
- **pnpm workspaces.** Cross-package deps use `workspace:*`. Don't add a
  package outside `packages/*` without updating `pnpm-workspace.yaml`.
- **Releases are Changesets-driven.** Every PR that touches a published
  package includes a changeset (`pnpm changeset`); versioning and npm publish
  happen from CI when the release PR merges (see `RELEASING.md`). Never
  publish or bump versions by hand. A **new package** under `packages/*`
  must be added to the `fixed` group in `.changeset/config.json` (all
  packages version in lockstep), or to `ignore` if it's private like
  `@smoove/docs`. New publishable packages also need a one-time
  trusted-publisher registration on npmjs.com (steps in `RELEASING.md`) —
  that part is for the maintainer, flag it in the PR.
- **`core` extends Konva classes.** `Composition extends Konva.Stage`,
  `Sequence extends Konva.Layer`, `Flex`/`Block`/`Image`/`Text` extend
  `Konva.Group`, and each shape wrapper extends its `Konva.Shape` (via the
  `FlexShape` mixin in `layout/flex/mixin.ts`). `konva` is a peer dep of `core`,
  not a regular dep, so consumers pin the version. The kitchen-sink app pins a
  real `konva` version. Aim: an app imports the whole drawing vocabulary from core, not
  `Konva.*`.
- **Layout is built in.** Wrappers use flexily (synchronous JS flexbox; no
  WASM/async init). `Sequence._apply` recomputes layout on any top-level `Flex`
  or `Block` child each tick, so animated sizes/gaps reflow without user wiring.
- **Layout dispatch is an open contract**, not an `instanceof` switch. Nodes
  implement `KMLayoutNode` (`layout/contract.ts`: `_kmRole`, `_kmMeasure?`,
  `_kmPlace`, `_kmComputeLayout?`); `flex.ts`/`sequence.ts` dispatch via
  `isKMLayoutNode`/`isKMLayoutRoot`. Wrap a new node type by implementing the
  contract instead of editing the engine. Shape wrappers use `getSelfRect()` for
  intrinsic size + origin-corrected placement; their config translator must
  *delete* (not `undefined`) absent width/height so `Circle`-style radius attrs
  aren't wiped.
- **Agnostic runtime.** `core` reads `requestAnimationFrame` /
  `cancelAnimationFrame` / `performance.now()` off `globalThis` with
  fallbacks, so importing in Node is safe. `play()` throws in non-browser;
  `setFrame(n)` works anywhere for offline / server rendering.
- **`@smoove/studio` is the reusable UI layer**; the `kitchen-sink` app is
  just a registry and routing shell around it. Don't put studio-shaped UI
  logic directly in `packages/kitchen-sink/` if it belongs in the package. New
  studio panels,
  dialogs, or hooks go in `packages/studio/src`.
- **Build = `tsc -b` per package**, _except_ `player`, which builds with
  **Vite** (library mode + vite-plugin-dts) so it can also ship a
  self-contained `<script>`-tag bundle. Emit goes to `dist/`; packages publish
  via the `exports` field pointing at `dist/`. Because player no longer emits
  via tsc, it is **not** a project-reference of other packages (studio/docs/root
  tsconfigs reference core/renderer only), so consumers resolve player types
  through its `types` field.
- **Biome** for lint + format (`pnpm check`, `pnpm format`). Config is at the
  repo root; there is no per-package Biome config.
- **No tests yet.** Add Vitest per-package when there's logic worth testing.
  Don't scaffold it preemptively.

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Studio reference app (Vite + React Router) |
| `pnpm dev:docs` | Fumadocs docs site at http://localhost:5176 |
| `pnpm build` | Build all `packages/*` |
| `pnpm check` | Biome lint + format check |
| `pnpm format` | Biome auto-format |
| `pnpm --filter @smoove/studio dev` | tsc watch for one package (swap the package name) |
| `./scripts/smoke-create.sh` | Scaffold + install + build every create-smoove template (slow) |

The `kitchen-sink` app imports each package's **built** entry (not source), so
after editing `packages/*/src` you need a `pnpm build` (or a `tsc -b --watch`
running in the package) before the change is visible in the app.

## Gotchas

- Vite and workspace symlinks resolve `@smoove/*` automatically, so no
  `resolve.alias` is needed. Don't add one.
- The kitchen-sink `tsconfig.json` uses `noEmit: true` and `composite: false`;
  it's for typechecking only. Vite handles the actual build.
- If you change package public API, update `doc/README.md` so the target API
  example stays accurate.
