# create-smoove Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline in the session. Do NOT use subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm create smoove` scaffolds a ready-to-run smoove project from GitHub-hosted templates (full studio, or a minimal Vite composition app in TS/JS), and points the user at the smoove-video agent skill.

**Architecture:** Templates are standalone, committed apps under `templates/` (outside the pnpm workspace, depending on published `@smoove/*@^0.1.2`). The CLI (`packages/create`, published unscoped as `create-smoove`) fetches a template subdirectory from `gh:smoove-dev/smoove` via giget, patches the package name, then optionally runs git init, dependency install, and `npx skills add smoove-dev/smoove`.

**Tech Stack:** Node ≥ 18, TypeScript (`tsc -b`, repo conventions), `giget`, `@clack/prompts`, `picocolors`. Templates: Vite 8 (composition) and React Router 8 SSR (studio).

**Spec:** `docs/superpowers/specs/2026-07-03-smoove-create-design.md`

**Versions policy:** Templates and the CLI use the LATEST published versions of every dependency. The pins below were checked against npm on 2026-07-03 (react-router 8.1.0, vite 8.1.3, react 19.2.7, typescript 6.0.3, konva 10.3.0, giget 3.3.0, @clack/prompts 1.6.0); at execution time re-confirm each with `npm view <pkg> version` and bump if newer. For API differences (the demo app this plan copies from is React Router 7.17-era), consult context7 (`resolve-library-id` → `query-docs`) rather than guessing. Known relevant v8 facts: `react-router-dom` is removed (the demo already imports from `react-router`, so no change), framework-mode `routes.ts` / `react-router.config.ts` / typegen are unchanged, and middleware is behind a `future.v8_middleware` flag we don't need.

**Testing note:** Repo convention (AGENTS.md) is no preemptive test scaffolding; verification is command-driven (scaffold → install → build) plus a reusable smoke script (Task 5). Every "Run/Expected" step is mandatory — do not claim a task done without running it.

---

## File structure (end state)

```
templates/composition-ts/      Vite vanilla-ts composition app
templates/composition-js/      Same app in JS
templates/studio/              React Router SSR studio app (trimmed demo)
packages/create/               create-smoove CLI
  src/index.ts                 bin entry + orchestration
  src/args.ts                  argv parsing (pure)
  src/scaffold.ts              template fetch/copy + package.json patch
  src/steps.ts                 git init / install / skill install helpers
scripts/smoke-create.sh        scaffold+install+build all templates locally
```

All three templates share the same sample composition (the smoove mark drawn as vectors + the "smoove" wordmark in Comfortaa). Canonical TS source is written in Task 1; Task 2 is its JS strip; Task 3 reuses the TS file verbatim.

---

### Task 1: `templates/composition-ts`

**Files:**
- Create: `templates/composition-ts/package.json`
- Create: `templates/composition-ts/index.html`
- Create: `templates/composition-ts/vite.config.ts`
- Create: `templates/composition-ts/tsconfig.json`
- Create: `templates/composition-ts/src/composition.ts`
- Create: `templates/composition-ts/src/main.ts`
- Create: `templates/composition-ts/.gitignore`
- Create: `templates/composition-ts/README.md`
- Create: `templates/composition-ts/AGENTS.md`
- Modify: `.gitignore` (repo root)

- [x] **Step 1: Confirm the published package versions exist**

Run: `npm view @smoove/core version && npm view @smoove/player version && npm view @smoove/google-fonts version`
Expected: each prints `0.1.2` (or newer). If a package is missing on npm, STOP and report — templates can't depend on unpublished versions.

- [x] **Step 2: Ignore template install artifacts at the repo root**

Append to the root `.gitignore` (node_modules/dist/build are already covered by existing unanchored patterns):

```
package-lock.json
```

- [x] **Step 3: Write `templates/composition-ts/package.json`**

```json
{
  "name": "my-smoove-composition",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@smoove/core": "^0.1.2",
    "@smoove/google-fonts": "^0.1.2",
    "@smoove/player": "^0.1.2",
    "konva": "^10.3.0"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "vite": "^8.1.3"
  }
}
```

- [x] **Step 4: Write `templates/composition-ts/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>smoove composition</title>
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
        background: #0d1117;
        display: grid;
        place-items: center;
      }
      smoove-player {
        width: min(90vw, 960px);
        aspect-ratio: 16 / 9;
      }
    </style>
  </head>
  <body>
    <smoove-player controls loop></smoove-player>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [x] **Step 5: Write `templates/composition-ts/vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: { target: "esnext" },
});
```

- [x] **Step 6: Write `templates/composition-ts/tsconfig.json`**

Standalone (templates must not reference repo-internal tsconfigs):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [x] **Step 7: Write `templates/composition-ts/src/composition.ts` (the shared sample)**

This is the canonical sample composition, reused by Tasks 2 and 3. Geometry comes from `assets/smoove-mark.svg` (120×120 viewBox: four rounded gradient bars at x 40/52/64/76 with half-heights 22/16/10/4 around y=60, stroke width 9, round caps; gradient `#FF5640` at x=40 → `#15CDA8` at x=84; a `#FFC23C` dot at (89, 60), r=3.5).

```ts
import { Block, Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import Comfortaa from "@smoove/google-fonts/comfortaa";
import Konva from "konva";

const fps = 30;
const durationInFrames = 120;
const width = 1280;
const height = 720;

const comp = new Composition({
  id: "hello-smoove",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

// The wordmark font. Registered on the sequence below so the composition
// buffers until the face is loaded.
const comfortaa = new Comfortaa({ weights: ["700"] });

const main = new Sequence({ from: 0, durationInFrames });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
main.add(comfortaa);

// The smoove mark, drawn as vectors. Geometry comes straight from the
// 120×120 mark SVG, scaled and centered above the wordmark.
const S = 2.6;
const offX = width / 2 - 60 * S;
const cy = height / 2 - 70;

const gradient = {
  strokeLinearGradientStartPoint: { x: offX + 40 * S, y: cy },
  strokeLinearGradientEndPoint: { x: offX + 84 * S, y: cy },
  strokeLinearGradientColorStops: [0, "#FF5640", 1, "#15CDA8"],
};

const bars = [
  { x: 40, half: 22 },
  { x: 52, half: 16 },
  { x: 64, half: 10 },
  { x: 76, half: 4 },
].map(({ x, half }) => {
  const X = offX + x * S;
  const node = new Konva.Line({
    points: [X, cy, X, cy],
    strokeWidth: 9 * S,
    lineCap: "round",
    opacity: 0,
    ...gradient,
  });
  main.add(node);
  return { node, X, half: half * S };
});

const dot = new Konva.Circle({
  x: offX + 89 * S,
  y: cy,
  radius: 3.5 * S,
  fill: "#FFC23C",
  scaleX: 0,
  scaleY: 0,
});
main.add(dot);

const wordmark = new Text({
  font: comfortaa.face("700"),
  text: "smoove",
  fontSize: 92,
  fill: "#e6edf3",
});
const labelY = cy + 60 * S + 8;
const label = new Block({
  x: 0,
  y: labelY,
  width,
  flexDirection: "row",
  justifyContent: "center",
  opacity: 0,
});
label.add(wordmark);
main.add(label);

comp.add(main);

main.register((frame) => {
  // Bars grow from their centers, staggered left to right.
  bars.forEach((bar, i) => {
    const t = interpolate(frame, [i * 5, i * 5 + 28], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    bar.node.opacity(Math.min(1, t * 4));
    bar.node.points([bar.X, cy - bar.half * t, bar.X, cy + bar.half * t]);
  });

  // The sunshine dot pops once the last bar lands.
  const pop = interpolate(frame, [34, 52], [0, 1], {
    easing: Easing.out(Easing.back(2)),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  dot.scaleX(pop);
  dot.scaleY(pop);

  // The wordmark rises and fades in under the mark.
  label.opacity(
    interpolate(frame, [48, 72], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  label.y(
    labelY +
      interpolate(frame, [48, 72], [24, 0], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
  );
});

export default comp;
```

- [x] **Step 8: Write `templates/composition-ts/src/main.ts`**

```ts
import "@smoove/player";
import "@smoove/player/styles.css";
import type { SmoovePlayer } from "@smoove/player";
import comp from "./composition";

const player = document.querySelector<SmoovePlayer>("smoove-player");
if (player) player.composition = comp;
```

- [x] **Step 9: Write `templates/composition-ts/.gitignore`**

```
node_modules
dist
```

- [x] **Step 10: Write `templates/composition-ts/README.md`**

Voice: follow the smoove-writing skill (plain, direct, no em dashes).

```markdown
# my smoove composition

A [smoove](https://smoove.dev) composition with live preview. Vite serves it
and reloads on every save.

## Run it

    npm install
    npm run dev

Open the printed URL. The player previews `src/composition.ts`; edit it and
the preview reloads.

## Where things live

- `src/composition.ts` is the composition: a `Composition` owns the frame
  clock, `Sequence`s are range-gated layers, and animation happens by
  mutating nodes inside `sequence.register((frame) => ...)`.
- `src/main.ts` mounts the `<smoove-player>` element and hands it the
  composition.

## Let your coding agent write compositions

Install the smoove-video skill so Claude Code, Cursor, Codex, and friends
know how to author smoove code:

    npx skills add smoove-dev/smoove

## Next steps

- Docs: https://smoove.dev
- Want the full studio (timeline UI, props panel, server rendering)? Run
  `npm create smoove studio`.
```

- [x] **Step 11: Write `templates/composition-ts/AGENTS.md`**

```markdown
# AGENTS.md

This is a smoove project. smoove brings Remotion-style timeline-driven
animation to Konva: a `Composition` owns the frame clock (fps +
durationInFrames), each `Sequence` is a range-gated layer, and you animate
by mutating Konva/smoove nodes inside `sequence.register((frame) => ...)`.
Every animated value must be a pure function of the frame. Import shapes
from `@smoove/core`, not `Konva.*`.

## Before writing composition code

Install and follow the `smoove-video` skill. It covers sequencing,
Flex/Block layout, interpolate-based animation, text, shapes, and media:

    npx skills add smoove-dev/smoove

## Layout

- `src/composition.ts` — the composition. This is the file to edit.
- `src/main.ts` — mounts `<smoove-player>`. Rarely needs changes.

Docs: https://smoove.dev
```

- [x] **Step 12: Verify the template installs and builds**

Run:

```bash
cd templates/composition-ts && npm install --no-audit --no-fund && npm run build && cd ../..
```

Expected: install succeeds against the npm registry (no `workspace:` errors), `tsc` passes, `vite build` emits `dist/`. If `comfortaa.face("700")` or any smoove API fails to typecheck, fix `src/composition.ts` against the installed package types (the smoove-video skill rules in `skills/smoove-video/rules/` are the reference).

- [x] **Step 13: Visually spot-check the sample (recommended)**

Run `npm run dev` inside `templates/composition-ts` and open the URL (or use the preview harness). Expected: dark page, four gradient bars grow staggered, yellow dot pops, "smoove" in Comfortaa rises in below. Tune `S`, `cy`, or `fontSize` if the layout is off-center. Kill the dev server after.

- [ ] **Step 14: Commit**

```bash
git add templates/composition-ts .gitignore
git commit -m "add composition-ts template"
```

---

### Task 2: `templates/composition-js`

**Files:**
- Create: `templates/composition-js/package.json`
- Create: `templates/composition-js/index.html`
- Create: `templates/composition-js/vite.config.js`
- Create: `templates/composition-js/src/composition.js`
- Create: `templates/composition-js/src/main.js`
- Create: `templates/composition-js/.gitignore`
- Create: `templates/composition-js/README.md`
- Create: `templates/composition-js/AGENTS.md`

- [x] **Step 1: Copy the TS template and strip it**

```bash
cp -R templates/composition-ts templates/composition-js
cd templates/composition-js
rm tsconfig.json
mv vite.config.ts vite.config.js
mv src/main.ts src/main.js
mv src/composition.ts src/composition.js
rm -rf node_modules dist package-lock.json
cd ../..
```

- [x] **Step 2: De-TypeScript the copied files**

`package.json`: remove the `typescript` devDependency and change the scripts to:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

`index.html`: change the script src to `/src/main.js`.

`src/main.js` (full content — the type import and generic are gone):

```js
import "@smoove/player";
import "@smoove/player/styles.css";
import comp from "./composition";

const player = document.querySelector("smoove-player");
if (player) player.composition = comp;
```

`src/composition.js`: identical to the TS file — it contains no type
annotations, so only the extension changes. Diff it to be sure:

```bash
diff templates/composition-ts/src/composition.ts templates/composition-js/src/composition.js
```

Expected: no output.

`README.md` / `AGENTS.md`: replace every `src/composition.ts` / `src/main.ts` mention with the `.js` names.

- [x] **Step 3: Verify**

```bash
cd templates/composition-js && npm install --no-audit --no-fund && npm run build && cd ../..
```

Expected: `vite build` emits `dist/`.

- [ ] **Step 4: Commit**

```bash
git add templates/composition-js
git commit -m "add composition-js template"
```

---

### Task 3: `templates/studio`

The demo app's architecture with a one-entry registry. Most files copy verbatim from `demo/`; the diffs are the registry, the composition, `package.json`, `tsconfig.json`, titles, and the docs files.

**Files:**
- Create: `templates/studio/package.json`, `tsconfig.json`, `.gitignore`, `README.md`, `AGENTS.md`
- Copy from demo (verbatim): `vite.config.ts`, `react-router.config.ts`, `src/routes.ts`, `src/app.css`, `src/entry.client.tsx`, `src/entry.server.tsx`, `src/node-module-shim.ts`, `src/render-client.ts`, `src/components/client-only.tsx`, `src/layouts/studio-layout.tsx`, `src/routes/*` (all 7), `src/server/*` (both)
- Copy with edits: `src/root.tsx`, `src/routes/home.tsx`
- Create: `src/registry.ts`, `src/compositions/hello-smoove/{composition.ts,index.ts}`

- [x] **Step 1: Copy the demo skeleton**

```bash
mkdir -p templates/studio/src
cp demo/vite.config.ts demo/react-router.config.ts templates/studio/
cp demo/src/routes.ts demo/src/app.css demo/src/entry.client.tsx demo/src/entry.server.tsx \
   demo/src/node-module-shim.ts demo/src/render-client.ts demo/src/root.tsx templates/studio/src/
cp -R demo/src/components demo/src/layouts demo/src/routes demo/src/server templates/studio/src/
```

- [x] **Step 2: Write `templates/studio/package.json`**

Published versions, no `workspace:*`. `@smoove/transitions` is included because it's a peer of `@smoove/renderer`, and `@react-router/serve` because the `start` script needs it.

```json
{
  "name": "my-smoove-studio",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "preview": "vite preview",
    "typecheck": "react-router typegen && tsc"
  },
  "dependencies": {
    "@react-router/node": "^8.1.0",
    "@react-router/serve": "^8.1.0",
    "@smoove/core": "^0.1.2",
    "@smoove/google-fonts": "^0.1.2",
    "@smoove/player": "^0.1.2",
    "@smoove/renderer": "^0.1.2",
    "@smoove/studio": "^0.1.2",
    "@smoove/transitions": "^0.1.2",
    "konva": "^10.3.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router": "^8.1.0"
  },
  "devDependencies": {
    "@react-router/dev": "^8.1.0",
    "@smoove/vite": "^0.1.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "typescript": "^6.0.3",
    "vite": "^8.1.3"
  }
}
```

- [x] **Step 3: Write `templates/studio/tsconfig.json`**

Standalone — inline the relevant `tsconfig.base.json` options, drop `composite`/`references` (they point at repo-internal paths):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "rootDirs": [".", "./.react-router/types"]
  },
  "include": ["src", "vite.config.ts", "react-router.config.ts", ".react-router/types/**/*"]
}
```

- [x] **Step 4: Write the sample composition**

`templates/studio/src/compositions/hello-smoove/composition.ts` — byte-identical to `templates/composition-ts/src/composition.ts`:

```bash
mkdir -p templates/studio/src/compositions/hello-smoove
cp templates/composition-ts/src/composition.ts templates/studio/src/compositions/hello-smoove/composition.ts
```

`templates/studio/src/compositions/hello-smoove/index.ts`:

```ts
import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "hello-smoove",
  title: "Hello smoove",
  group: "Basics",
  description: "The smoove mark draws itself, then the wordmark settles in.",
  tags: ["intro"],
  composition: () => import("./composition.js"),
};

export default entry;
```

- [x] **Step 5: Write `templates/studio/src/registry.ts`**

```ts
import { defineRegistry } from "@smoove/studio";
import helloSmoove from "./compositions/hello-smoove/index.js";

/**
 * Every composition in the studio is one registry entry. Add a folder under
 * src/compositions/, export a RegistryEntry from its index.ts, and list it
 * here — the sidebar, stage, and server renderer all read from this file.
 */
export default defineRegistry([helloSmoove]);
```

- [x] **Step 6: Retitle the copied shell files**

`templates/studio/src/root.tsx`: change `<title>SmooveStudio — demo2</title>` to `<title>Smoove Studio</title>`.

`templates/studio/src/routes/home.tsx`: change `sub="smoove · demo2"` to `sub="smoove studio"`. Leave the rest — the copy explains the routing/shell wiring and is accurate for the template.

Then check nothing else references the demo:

```bash
grep -rn "demo2\|workspace:" templates/studio/src templates/studio/*.ts templates/studio/*.json
```

Expected: no matches (comments in `vite.config.ts` mentioning demo2 may remain; reword them to "the app" if grep finds them).

- [x] **Step 7: Write `.gitignore`, `README.md`, `AGENTS.md`**

`templates/studio/.gitignore`:

```
node_modules
build
dist
.react-router
```

`templates/studio/README.md`:

```markdown
# my smoove studio

A full [smoove](https://smoove.dev) studio: browse compositions, scrub the
timeline, tweak props, and render MP4s on the built-in server queue.

## Run it

    npm install
    npm run dev

Open the printed URL. Pick "Hello smoove" in the sidebar to see the stage,
timeline, and inspector.

## Add a composition

1. Create `src/compositions/<name>/composition.ts` (default-export a
   `Composition`).
2. Create `src/compositions/<name>/index.ts` (a `RegistryEntry` that lazy
   imports it).
3. List the entry in `src/registry.ts`.

## Render to video

Open a composition, choose "Render…" from the menu, and watch it in the
Render Queue. Jobs run on the Node server through `@smoove/renderer`, so
what you preview is what you get.

## Let your coding agent write compositions

Install the smoove-video skill so Claude Code, Cursor, Codex, and friends
know how to author smoove code:

    npx skills add smoove-dev/smoove

Docs: https://smoove.dev
```

`templates/studio/AGENTS.md`:

```markdown
# AGENTS.md

This is a smoove studio project. smoove brings Remotion-style
timeline-driven animation to Konva: a `Composition` owns the frame clock
(fps + durationInFrames), each `Sequence` is a range-gated layer, and you
animate by mutating Konva/smoove nodes inside
`sequence.register((frame) => ...)`. Every animated value must be a pure
function of the frame. Import shapes from `@smoove/core`, not `Konva.*`.

## Before writing composition code

Install and follow the `smoove-video` skill. It covers sequencing,
Flex/Block layout, interpolate-based animation, text, shapes, and media:

    npx skills add smoove-dev/smoove

## Layout

- `src/compositions/<name>/composition.ts` — a composition (this is where
  animation code lives). Its sibling `index.ts` is the registry entry.
- `src/registry.ts` — the catalog the studio UI and the server renderer
  share. New compositions must be listed here.
- `src/layouts/studio-layout.tsx`, `src/routes/` — the studio shell
  (React Router). Rarely needs changes.
- `src/server/`, `src/routes/api.render.*` — the server render queue.

Docs: https://smoove.dev
```

- [x] **Step 8: Verify install, typecheck, and build**

```bash
cd templates/studio && npm install --no-audit --no-fund && npm run typecheck && npm run build && cd ../..
```

Expected: install succeeds (skia-canvas and @mediabunny/server pull prebuilt binaries — this is the slow one), typegen + `tsc` pass, `react-router build` emits `build/`. Common failure: type errors from `+types/*` imports before `react-router typegen` runs — the `typecheck` script handles the order. If anything else breaks, remember the copied source is React Router 7.17-era running on 8.1 and React 19 — check the v8 upgrade guide via context7 (`/remix-run/react-router`) before patching by hand.

- [x] **Step 9: Spot-check the studio (recommended)**

`npm run dev` inside `templates/studio`, open the URL: sidebar shows "Hello smoove", opening it shows the animating mark, and "Render…" enqueues a job that completes in the queue view. Kill the server after.

- [ ] **Step 10: Commit**

```bash
git add templates/studio
git commit -m "add studio template"
```

---

### Task 4: the `create-smoove` CLI (`packages/create`)

**Files:**
- Create: `packages/create/package.json`
- Create: `packages/create/tsconfig.json`
- Create: `packages/create/src/args.ts`
- Create: `packages/create/src/scaffold.ts`
- Create: `packages/create/src/steps.ts`
- Create: `packages/create/src/index.ts`
- Create: `packages/create/README.md`

- [x] **Step 1: Write `packages/create/package.json`**

Unscoped on purpose — npm's `create` shorthand maps `npm create smoove` → the `create-smoove` package. Version matches the release train so the root `release` script publishes it with the rest.

```json
{
  "name": "create-smoove",
  "version": "0.1.2",
  "description": "Scaffold a smoove video project: full studio or a minimal composition app, ready to run.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/smoove-dev/smoove.git",
    "directory": "packages/create"
  },
  "homepage": "https://smoove.dev",
  "bugs": "https://github.com/smoove-dev/smoove/issues",
  "type": "module",
  "bin": {
    "create-smoove": "./dist/index.js"
  },
  "files": ["dist"],
  "engines": { "node": ">=18.17" },
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "clean": "rm -rf dist *.tsbuildinfo",
    "prepublishOnly": "pnpm build"
  },
  "dependencies": {
    "@clack/prompts": "^1.6.0",
    "giget": "^3.3.0",
    "picocolors": "^1.1.1"
  },
  "devDependencies": {
    "@types/node": "^26.1.0"
  },
  "publishConfig": { "access": "public" }
}
```

- [x] **Step 2: Write `packages/create/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"]
}
```

(Note: `module: NodeNext` overrides the base's `ESNext`/`bundler` because this package runs directly under Node, not through a bundler. Internal imports therefore need explicit `.js` extensions.)

- [x] **Step 3: Write `packages/create/src/args.ts`**

```ts
import { parseArgs } from "node:util";

export const TEMPLATES = ["studio", "composition"] as const;
export type TemplateName = (typeof TEMPLATES)[number];

export interface CliOptions {
  template?: TemplateName;
  dir?: string;
  language?: "ts" | "js";
  install: boolean;
  git: boolean;
  /** undefined = ask interactively */
  skill?: boolean;
  help: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ts: { type: "boolean" },
      js: { type: "boolean" },
      "no-install": { type: "boolean" },
      "no-git": { type: "boolean" },
      "no-skill": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  const [templateArg, dirArg] = positionals;
  if (templateArg && !(TEMPLATES as readonly string[]).includes(templateArg)) {
    throw new Error(
      `Unknown template "${templateArg}". Available templates: ${TEMPLATES.join(", ")}.`,
    );
  }
  if (values.ts && values.js) {
    throw new Error("Pass either --ts or --js, not both.");
  }

  return {
    template: templateArg as TemplateName | undefined,
    dir: dirArg,
    language: values.ts ? "ts" : values.js ? "js" : undefined,
    install: !values["no-install"],
    git: !values["no-git"],
    skill: values["no-skill"] ? false : undefined,
    help: values.help ?? false,
  };
}
```

- [x] **Step 4: Write `packages/create/src/scaffold.ts`**

(If `downloadTemplate` fails to typecheck against the installed giget 3.x, check giget's README for the current signature — the `gh:owner/repo/subdir#ref` source format is the part that matters.)

```ts
import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadTemplate } from "giget";

const REPO = "gh:smoove-dev/smoove";
/** Never copy local build/install artifacts into a scaffolded project. */
const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".react-router",
  "package-lock.json",
]);

/**
 * Materialize a template into targetDir. SMOOVE_CREATE_TEMPLATE_DIR (a local
 * checkout's templates/ dir) short-circuits the GitHub fetch for development
 * and CI smoke tests.
 */
export async function fetchTemplate(templateName: string, targetDir: string): Promise<void> {
  const localRoot = process.env.SMOOVE_CREATE_TEMPLATE_DIR;
  if (localRoot) {
    await cp(path.join(localRoot, templateName), targetDir, {
      recursive: true,
      filter: (src) => !src.split(path.sep).some((seg) => EXCLUDED_SEGMENTS.has(seg)),
    });
    return;
  }
  try {
    await downloadTemplate(`${REPO}/templates/${templateName}#main`, {
      dir: targetDir,
      force: true,
    });
  } catch (cause) {
    throw new Error(
      "Could not download the template from GitHub. Check your network and try again,\n" +
        `or scaffold manually: npx giget@latest ${REPO}/templates/${templateName} <dir>`,
      { cause },
    );
  }
}

/** Set the scaffolded package.json name from the target directory's basename. */
export async function patchPackageName(targetDir: string): Promise<string> {
  const file = path.join(targetDir, "package.json");
  const pkg = JSON.parse(await readFile(file, "utf8")) as { name?: string };
  const name = path
    .basename(path.resolve(targetDir))
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "") || "smoove-app";
  pkg.name = name;
  await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
  return name;
}
```

- [x] **Step 5: Write `packages/create/src/steps.ts`**

```ts
import { spawnSync } from "node:child_process";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** Whatever launched us (npm create / pnpm create / yarn create) installs. */
export function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm")) return "pnpm";
  if (agent.startsWith("yarn")) return "yarn";
  if (agent.startsWith("bun")) return "bun";
  return "npm";
}

/** Run an interactive child command; false = non-zero exit or spawn failure. */
export function run(command: string, args: string[], cwd: string): boolean {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  return result.status === 0;
}

/** True if dir is already inside a git work tree (skip git init). */
export function isInsideGitRepo(cwd: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd,
    stdio: "ignore",
  });
  return result.status === 0;
}

export function gitInit(cwd: string): boolean {
  return run("git", ["init", "-q"], cwd);
}

export function installDeps(pm: PackageManager, cwd: string): boolean {
  return run(pm, ["install"], cwd);
}

/** The skills CLI owns the agent picker (Claude Code / Cursor / Codex / ...). */
export function installSkill(cwd: string): boolean {
  return run("npx", ["-y", "skills", "add", "smoove-dev/smoove"], cwd);
}
```

- [x] **Step 6: Write `packages/create/src/index.ts`**

```ts
#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { type CliOptions, parseCliArgs } from "./args.js";
import { fetchTemplate, patchPackageName } from "./scaffold.js";
import {
  detectPackageManager,
  gitInit,
  installDeps,
  installSkill,
  isInsideGitRepo,
} from "./steps.js";

const HELP = `create-smoove — scaffold a smoove video project

Usage:
  npm create smoove [template] [dir] [options]

Templates:
  studio        Full studio: React Router app with timeline UI, props panel,
                and a server render queue.
  composition   Minimal Vite app: one composition, <smoove-player> preview,
                autoreload.

Options:
  --ts / --js   Language for the composition template (default: ask)
  --no-install  Skip installing dependencies
  --no-git      Skip git init
  --no-skill    Skip the smoove-video agent-skill install
  -h, --help    Show this help
`;

async function main(): Promise<void> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(pc.red(String(err instanceof Error ? err.message : err)));
    console.error(HELP);
    process.exit(1);
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const interactive = process.stdout.isTTY === true;
  p.intro(pc.bgCyan(pc.black(" create-smoove ")));

  // -- resolve template ------------------------------------------------
  let template = opts.template;
  if (!template) {
    if (!interactive) bail("Pass a template (studio | composition) in non-interactive mode.");
    template = guard(
      await p.select({
        message: "Which template?",
        options: [
          {
            value: "studio" as const,
            label: "studio",
            hint: "timeline UI, props panel, server rendering",
          },
          {
            value: "composition" as const,
            label: "composition",
            hint: "one composition + player preview, Vite",
          },
        ],
      }),
    );
  }

  // -- resolve language (composition only) -----------------------------
  let language = opts.language;
  if (template === "composition" && !language) {
    if (!interactive) {
      language = "ts";
    } else {
      language = guard(
        await p.select({
          message: "TypeScript or JavaScript?",
          options: [
            { value: "ts" as const, label: "TypeScript" },
            { value: "js" as const, label: "JavaScript" },
          ],
        }),
      );
    }
  }
  const templateDir = template === "composition" ? `composition-${language}` : "studio";

  // -- resolve target dir ----------------------------------------------
  let dir = opts.dir;
  if (!dir) {
    if (!interactive) bail("Pass a target directory in non-interactive mode.");
    dir = guard(
      await p.text({
        message: "Where should the project go?",
        placeholder: template === "studio" ? "./my-smoove-studio" : "./my-composition",
        validate: (v) => (v.trim() ? undefined : "Enter a directory"),
      }),
    ).trim();
  }
  const targetDir = path.resolve(dir);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    if (!interactive) bail(`Target directory ${dir} is not empty.`);
    const overwrite = guard(
      await p.confirm({
        message: `${dir} is not empty. Continue and write into it anyway?`,
        initialValue: false,
      }),
    );
    if (!overwrite) bail("Aborted.");
  }

  // -- scaffold ----------------------------------------------------------
  const s = p.spinner();
  s.start(`Fetching the ${template} template`);
  let pkgName: string;
  try {
    await fetchTemplate(templateDir, targetDir);
    pkgName = await patchPackageName(targetDir);
  } catch (err) {
    s.stop("Fetch failed");
    bail(String(err instanceof Error ? err.message : err));
  }
  s.stop(`Scaffolded ${pc.cyan(pkgName)}`);

  // -- optional steps ----------------------------------------------------
  const notes: string[] = [];
  const pm = detectPackageManager();

  if (opts.git && !isInsideGitRepo(targetDir)) {
    if (!gitInit(targetDir)) notes.push("git init failed — run it yourself.");
  }

  if (opts.install) {
    p.log.step(`Installing dependencies with ${pm}`);
    if (!installDeps(pm, targetDir)) notes.push(`Install failed — run \`${pm} install\` in ${dir}.`);
  } else {
    notes.push(`Install dependencies: cd ${dir} && ${pm} install`);
  }

  let skill = opts.skill;
  if (skill === undefined) {
    skill = interactive
      ? guard(
          await p.confirm({
            message: "Install the smoove-video agent skill (Claude Code, Cursor, Codex, ...)?",
            initialValue: true,
          }),
        )
      : false;
  }
  if (skill) {
    if (!installSkill(targetDir))
      notes.push("Skill install failed — run `npx skills add smoove-dev/smoove` in the project.");
  } else {
    notes.push("Agent skill (optional): npx skills add smoove-dev/smoove");
  }

  // -- summary -----------------------------------------------------------
  const dev = pm === "npm" ? "npm run dev" : `${pm} dev`;
  p.note(
    [`cd ${dir}`, opts.install ? dev : `${pm} install && ${dev}`, "", ...notes].join("\n"),
    "Next steps",
  );
  p.outro(`Docs: ${pc.underline("https://smoove.dev")}`);
}

/** Unwrap a clack prompt result, exiting cleanly on Ctrl-C. */
function guard<T>(value: T | symbol): T {
  if (p.isCancel(value)) bail("Cancelled.");
  return value as T;
}

function bail(message: string): never {
  p.cancel(message);
  process.exit(1);
}

main().catch((err) => {
  console.error(pc.red(String(err instanceof Error ? (err.stack ?? err.message) : err)));
  process.exit(1);
});
```

- [x] **Step 7: Write `packages/create/README.md`**

```markdown
# create-smoove

Scaffold a [smoove](https://smoove.dev) video project.

    npm create smoove
    # or
    pnpm create smoove studio my-studio
    npm create smoove composition my-comp -- --ts

Two templates:

- **studio** — the full studio: browse compositions, scrub the timeline,
  tweak props, render MP4s on a built-in server queue.
- **composition** — a minimal Vite app: one composition, `<smoove-player>`
  preview, autoreload. TypeScript or JavaScript.

Both come with the smoove-video agent skill one command away
(`npx skills add smoove-dev/smoove`), so your coding agent knows how to
write smoove compositions.

Options: `--ts` / `--js`, `--no-install`, `--no-git`, `--no-skill`.

Templates live in [`templates/`](https://github.com/smoove-dev/smoove/tree/main/templates)
and are fetched from `main` at run time, so fixes land without a new CLI
release.
```

- [x] **Step 8: Install workspace deps and build**

```bash
pnpm install
pnpm --filter create-smoove build
```

Expected: giget/@clack/prompts/picocolors added to the lockfile; `tsc -b` emits `packages/create/dist/index.js` with the shebang intact (check: `head -1 packages/create/dist/index.js` prints `#!/usr/bin/env node`).

- [x] **Step 9: Verify the CLI end-to-end against local templates**

```bash
TMP=$(mktemp -d)
SMOOVE_CREATE_TEMPLATE_DIR=$PWD/templates node packages/create/dist/index.js \
  composition "$TMP/my-comp" --ts --no-install --no-git --no-skill
ls "$TMP/my-comp/src" && grep '"name"' "$TMP/my-comp/package.json"
```

Expected: `composition.ts main.ts` listed; name is `"my-comp"`. Also verify help and error paths:

```bash
node packages/create/dist/index.js --help          # prints usage, exit 0
node packages/create/dist/index.js bogus 2>&1 | head -2   # "Unknown template" + usage, exit 1
```

- [ ] **Step 10: Verify the GitHub fetch path (network)**

Only meaningful once the templates are pushed to `main` on GitHub. If they aren't yet, defer this step to after the branch merges and note it in the final report:

```bash
node packages/create/dist/index.js composition "$TMP/gh-comp" --ts --no-install --no-git --no-skill
```

Expected: fetches from `gh:smoove-dev/smoove/templates/composition-ts`, same file listing as Step 9.

- [ ] **Step 11: Commit**

```bash
git add packages/create pnpm-lock.yaml
git commit -m "add create-smoove scaffolding CLI"
```

---

### Task 5: smoke script

**Files:**
- Create: `scripts/smoke-create.sh`

- [x] **Step 1: Write `scripts/smoke-create.sh`**

```bash
#!/usr/bin/env bash
# Scaffold every template from the local templates/ dir, install from the
# public npm registry, and build. Run before releases (slow: the studio
# template pulls skia-canvas + ffmpeg natives).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pnpm --filter create-smoove build

scaffold() {
  local name="$1"; shift
  echo "--- $name ---"
  SMOOVE_CREATE_TEMPLATE_DIR="$ROOT/templates" node "$ROOT/packages/create/dist/index.js" \
    "$@" "$TMP/$name" --no-git --no-skill --no-install
  (cd "$TMP/$name" && npm install --no-audit --no-fund && npm run build)
}

scaffold comp-ts composition --ts
scaffold comp-js composition --js
scaffold studio studio

echo "smoke-create: all templates scaffold, install, and build ✔"
```

- [x] **Step 2: Make it executable and run it**

```bash
chmod +x scripts/smoke-create.sh
./scripts/smoke-create.sh
```

Expected: three `--- name ---` blocks, each ending in a successful build, then the final ✔ line.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-create.sh
git commit -m "add create-smoove smoke script"
```

---

### Task 6: repo housekeeping

**Files:**
- Modify: `scripts/bump.mjs` (also update `@smoove/*` ranges in templates)
- Modify: `AGENTS.md` (layout table + commands table)
- Modify: `tsconfig.json` (root — add the create reference)

- [x] **Step 0: Teach `scripts/bump.mjs` to update the templates**

Templates pin literal ranges (`"@smoove/core": "^0.1.2"`), not `workspace:*`, so the lockstep bump must rewrite them too or a release strands the templates on the old version line (`^0.1.2` does not match `0.2.x`). Append after the existing `packages/*` loop (before the final `console.log`):

```js
// Templates aren't workspace packages — they pin literal @smoove/* ranges so a
// raw GitHub fetch installs from npm. Keep those ranges on the released line.
const templatesDir = join(root, "templates");
for (const dir of readdirSync(templatesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)) {
  const path = join(templatesDir, dir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  let touched = false;
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (name.startsWith("@smoove/")) {
        pkg[field][name] = `^${next}`;
        touched = true;
      }
    }
  }
  if (touched) {
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`templates/${dir}  @smoove/* -> ^${next}`);
  }
}
```

Verify without keeping the change:

```bash
node scripts/bump.mjs 0.1.2
git diff --stat templates packages | tail -3
git checkout -- packages templates
```

Expected: the diff touches every `templates/*/package.json` (plus all `packages/*` versions), and `templates/composition-ts/package.json` shows `@smoove/*` at `^0.1.2`. Re-running with the current version is a no-op diff for ranges already correct — that's fine; the point is the loop runs and writes valid JSON.

- [x] **Step 1: Add layout rows to `AGENTS.md`**

In the layout code block (after the `packages/vite` line), add:

```
packages/create        create-smoove: the `npm create smoove` scaffolding CLI. Fetches a template from gh:smoove-dev/smoove/templates at run time (giget), patches the name, offers install + `npx skills add smoove-dev/smoove`. Unscoped on purpose — npm's create shorthand requires `create-<name>`. SMOOVE_CREATE_TEMPLATE_DIR=<path to templates/> scaffolds from a local checkout instead.
```

And after the `demo` line:

```
templates              Standalone starter apps served by create-smoove: `studio` (trimmed demo: React Router SSR + <Studio> + server render queue) and `composition-ts`/`composition-js` (minimal Vite + <smoove-player>). NOT in the pnpm workspace — they depend on published @smoove/* versions so a raw GitHub fetch installs cleanly. Keep the two composition variants in sync by hand; scripts/smoke-create.sh verifies all three build.
```

Add to the commands table:

```
| `./scripts/smoke-create.sh` | Scaffold + install + build every create-smoove template (slow) |
```

- [x] **Step 2: Add the project reference to the root `tsconfig.json`**

Add `{ "path": "./packages/create" }` to the `references` array. (The array already contains stale entries like `packages/timeline` and `demo2`; leave them — cleaning that up is separate work.)

- [x] **Step 3: Full-repo check**

```bash
pnpm check && pnpm build
```

Expected: Biome passes (templates and `packages/create` are formatted to repo style — run `pnpm format` first if it flags them), all packages build.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md tsconfig.json
git commit -m "register create-smoove and templates in repo docs"
```

---

## Final verification (before claiming done)

- [x] `./scripts/smoke-create.sh` passes end to end.
- [x] `pnpm check && pnpm build` pass at the repo root.
- [x] `node packages/create/dist/index.js --help` prints usage.
- [x] Interactive path spot-checked once: `SMOOVE_CREATE_TEMPLATE_DIR=$PWD/templates node packages/create/dist/index.js` with no args — template picker, language picker, dir prompt, skill confirm all appear and Ctrl-C exits cleanly.
- [ ] Report which steps were deferred (e.g. Task 4 Step 10 GitHub fetch, publishing `create-smoove` to npm — publishing happens via the existing root `release` script, not this plan).
