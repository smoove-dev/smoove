# `@smoove/media` Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Rotem's standing rule forbids subagent-driven execution — implement inline in the main session). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commits:** Each task ends with a `git commit` step as a natural boundary, but per repo convention ([[no-unrequested-commits]]) do **not** run it unless Rotem explicitly asks. Stage/verify and pause otherwise.

**Goal:** Move the `Audio`/`Video` nodes and their concrete `mediabunny` decoders into a new `@smoove/media` package so `@smoove/core` drops the `mediabunny` dependency (~10 MB) entirely from both its bundle and install footprint, while remaining a media-*aware* engine.

**Architecture:** The engine already discovers media by string marker (`MEDIA_MARK`) and drives it through optional `_km*` methods — it never imports the node classes. We exploit that seam: promote the marker leaf to a general `core/src/markers.ts`, keep the node-agnostic substrate (mixer, asset, source *interfaces*, DI seam, mark-based predicates) in core, and relocate only the concrete nodes/sources/drivers to `@smoove/media`. Core's runtime-default source factories stop referencing `mediabunny`; `@smoove/media`'s entry side-effect registers the browser `Mediabunny*` sources into core's DI singleton. `@smoove/renderer` keeps its own Node sources and needs no new dependency.

**Tech Stack:** TypeScript project references (`tsc -b`), pnpm workspace, Konva, mediabunny, Changesets (fixed group).

---

## Locked decisions (from the spec's "open decisions")

1. **Registration:** package **entry side-effect** (`@smoove/media`'s `src/index.ts` calls `setDefault*SourceFactory` on load). No `/register` subpath — zero-ceremony DX.
2. **Substrate exposure:** **main core barrel**, matching the existing `computeOffsets` precedent (exported but tagged `// @internal` where it's engine-internal). No `@smoove/core/internal` subpath.
3. **Core-retained media leaves:** **keep their existing paths** (`media/media-time.ts`, `media/audio/asset.ts`, `media/audio/mixer.ts`, `media/audio/audio-source.ts`, `media/video/video-source.ts` stay put). Only `media/media-marker.ts` → `core/src/markers.ts` (spec-required), and the `isAudioNode`/`isVideoNode` predicates get extracted into `markers.ts`.
4. **Driver-context types (spec's "Driver-context types the nodes/drivers share" bullet): NOT exported from core.** The contexts (`AudioDriverContext`/`AudioDriver` in `audio-driver.ts`, `VideoDriverContext`/`VideoDriver`/`VideoTiming` in `video/driver.ts`) move to `@smoove/media` *with* their driver files. Once the nodes and all four driver implementations live in one package, no consumer outside media touches these types — core exporting them would be dead public surface. This is a deliberate deviation from the spec's core-surface list; revisit only if a third package ever authors a custom driver.

## ⚠️ Deviation from spec you must apply

The spec's "Package shape" (line 198) says `peer: @smoove/core, konva`. **Do not make `@smoove/core` a peer dependency.** Per [[changesets-fixed-peer-major-escalation]], sibling `@smoove/*` `peerDependencies` inside the `fixed` group force every minor release to escalate to `1.0.0`. `@smoove/media` must declare `@smoove/core` as a regular **`dependency`** (`workspace:^`), exactly like `@smoove/transitions`. Only `konva` stays a peer.

## File map

**Core — modified in place**
- `packages/core/src/markers.ts` — **new** (moved from `media/media-marker.ts`); generalized doc; adds `isAudioNode`/`isVideoNode` (return `boolean`).
- `packages/core/src/media/media-marker.ts` — **deleted**.
- `packages/core/src/engine/runtime-defaults.ts` — drop `Mediabunny*` imports; default factories throw an "unregistered" error.
- `packages/core/src/index.ts` — export new substrate; stop exporting nodes/concrete sources/configs.
- `packages/core/package.json` — remove `mediabunny` dependency.
- Marker importers repointed to `../markers`/`../../markers`: `engine/sequence.ts`, `engine/composition.ts`, `layout/image.ts`, `layout/text/text.ts`, `layout/text/font.ts`, `layout/group.ts`.

**Core — deleted (moved to media)**
- `media/audio/index.ts`, `media/video/index.ts` (nodes)
- `media/audio/audio-source-browser.ts`, `media/audio/audio-source-mediabunny.ts`, `media/video/video-source-browser.ts`, `media/video/video-source-mediabunny.ts`
- `media/audio/audio-driver.ts`, `media/audio/audio-for-preview.ts`, `media/audio/audio-for-rendering.ts`, `media/audio/shared-audio-context.ts`
- `media/video/driver.ts`, `media/video/video-for-preview.ts`, `media/video/video-for-rendering.ts`
- `media/audio/types.ts`, `media/video/types.ts` (`AudioConfig`/`VideoConfig`)

**Core — stays put (retained substrate)**
- `media/media-time.ts`, `media/audio/asset.ts`, `media/audio/mixer.ts`, `media/audio/audio-source.ts` (`AudioSource`/`AudioSourceFactory`/`SeekMode` re-export), `media/video/video-source.ts` (`VideoSource`/`VideoSourceFactory`/`SeekMode`).

**New package**
- `packages/media/package.json`, `packages/media/tsconfig.json`, `packages/media/src/index.ts`, plus the moved `src/audio/*` and `src/video/*` trees.

**Repo wiring**
- `tsconfig.json` (root) — add `{ "path": "./packages/media" }`.
- `.changeset/config.json` — add `@smoove/media` to the `fixed` group.

**In-repo consumers repointed to `@smoove/media`**
- `packages/renderer/examples/audio-mixer.ts`, `packages/renderer/examples/render-demo.ts` (+ renderer `devDependency`)
- `packages/docs/src/demos/audio-mixer.ts`, `packages/docs/src/demos/video-sync.ts` (+ docs dep)
- `packages/kitchen-sink/src/compositions/audio-mixer/composition.ts`, `cohabit/composition.ts`, `transitions/_shared.ts`, `video-sync/composition.ts` (+ kitchen-sink dep)

**Docs/skill**
- `skills/smoove-video/rules/media.md` (+ `.agents/skills/...` mirror — verified present) — import path `@smoove/core` → `@smoove/media`.
- `packages/docs/content/docs/audio.mdx` (line 13), `packages/docs/content/docs/video.mdx` (line 12) — split the import examples; add an install note.
- `doc/README.md` — prose at line 832 (`@smoove/core` ships an `Audio` node…) and the import examples at lines 840 and 1006.
- Verified **no change needed**: `packages/docs/content/docs/installation.mdx` (installs core only, no media authoring), `packages/docs/content/docs/rendering/media.mdx` (its `new Video({...})` snippets carry no import line, and its `MediabunnyVideoSource` mention is the *renderer's* Node source, which stays put).

---

## Task 1: Generalize the marker leaf + widen core's public substrate

Rename the mis-located `media/media-marker.ts` to a neutral `core/src/markers.ts`, move the two mark-based predicates into it, and export the substrate a sibling package needs. Core stays green throughout.

**Files:**
- Create: `packages/core/src/markers.ts`
- Delete: `packages/core/src/media/media-marker.ts`
- Modify: `packages/core/src/engine/sequence.ts`, `packages/core/src/engine/composition.ts`, `packages/core/src/layout/image.ts`, `packages/core/src/layout/text/text.ts`, `packages/core/src/layout/text/font.ts`, `packages/core/src/layout/group.ts`
- Modify: `packages/core/src/media/audio/index.ts`, `packages/core/src/media/video/index.ts` (drop their local predicates; repoint marker import — these files move in Task 3 but must compile now)
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/src/markers.ts`**

```ts
/**
 * The engine's general **node-marker contract**: string attrs stamped on Konva
 * nodes so the engine and tooling can discover and classify nodes by string,
 * without importing the node classes (which would create import cycles). A
 * sibling of `layout/contract.ts` (the `KMLayoutNode` contract). Kept
 * dependency-free (type-only Konva import) so `composition.ts`/`sequence.ts`
 * can consume it from any layer.
 */

import type Konva from "konva";

/** Set by every tickable media node — drives Sequence discovery + mixer registration. */
export const MEDIA_MARK = "__kmIsMedia";
/** Additionally set by `Video` — backs {@link isVideoNode}. */
export const VIDEO_MARK = "__kmIsVideo";
/** Additionally set by `Audio` — backs {@link isAudioNode}. */
export const AUDIO_MARK = "__kmIsAudio";
/**
 * Set by non-media nodes that still want a per-frame `_kmTick` callback (e.g.
 * `Text`'s typewriter). Discovered by `Sequence` alongside media, but NOT
 * registered with the audio mixer.
 */
export const TICK_MARK = "__kmIsTick";
/**
 * Set by `Font` nodes. Walked by `Composition.add` so a scene-declared font is
 * loaded (and buffered on) before playback — discovered by string so
 * `composition.ts` need not import `layout/text/`.
 */
export const FONT_MARK = "__kmIsFont";
/**
 * Set by smoove's `Group` container — distinguishes an author-created grouping
 * node from the internal `Konva.Group`s smoove builds inside `Text`, `Flex`,
 * etc. Backs `isGroupNode`.
 */
export const GROUP_MARK = "__kmIsGroup";

/**
 * True if `node` is an audio media node. A pure mark check with no dependency
 * on the `Audio` class, so it lives in core even though `Audio` ships in
 * `@smoove/media`. `@smoove/renderer` uses it as a boolean media probe;
 * `@smoove/media` re-exports a typed guard that narrows to its concrete `Audio`.
 */
export function isAudioNode(node: Konva.Node): boolean {
  return node.getAttr(AUDIO_MARK) === true;
}

/** True if `node` is a video media node. See {@link isAudioNode}. */
export function isVideoNode(node: Konva.Node): boolean {
  return node.getAttr(VIDEO_MARK) === true;
}
```

- [ ] **Step 2: Delete the old marker file**

```bash
git rm packages/core/src/media/media-marker.ts
```

- [ ] **Step 3: Repoint the six core marker importers**

In each file, change the import specifier from the media leaf to the new top-level `markers.ts`. The imported names are unchanged.

- `packages/core/src/engine/sequence.ts`: `from "../media/media-marker.js"` → `from "../markers.js"`
- `packages/core/src/engine/composition.ts`: `from "../media/media-marker.js"` → `from "../markers.js"`
- `packages/core/src/layout/image.ts`: `from "../media/media-marker.js"` → `from "../markers.js"`
- `packages/core/src/layout/text/text.ts`: `from "../../media/media-marker.js"` → `from "../../markers.js"`
- `packages/core/src/layout/text/font.ts`: `from "../../media/media-marker.js"` → `from "../../markers.js"`
- `packages/core/src/layout/group.ts`: `from "../media/media-marker.js"` → `from "../markers.js"`

Verify none remain:

```bash
grep -rn "media-marker" packages/core/src   # expect: no output
```

- [ ] **Step 4: Drop the duplicate predicates from the node files**

In `packages/core/src/media/audio/index.ts`:
- Change the marker import line 6 `import { AUDIO_MARK, MEDIA_MARK } from "../media-marker.js";` → `import { AUDIO_MARK, MEDIA_MARK } from "../../markers.js";`
- Delete the trailing local definition (lines 194-196):

```ts
export function isAudioNode(node: Konva.Node): node is Audio {
  return node.getAttr(AUDIO_MARK) === true;
}
```

In `packages/core/src/media/video/index.ts`:
- Change the marker import line 15 `import { MEDIA_MARK, VIDEO_MARK } from "../media-marker.js";` → `import { MEDIA_MARK, VIDEO_MARK } from "../../markers.js";`
- Delete the trailing local definition (lines 363-365):

```ts
export function isVideoNode(node: Konva.Node): node is Video {
  return node.getAttr(VIDEO_MARK) === true;
}
```

(Both files also still use `AUDIO_MARK`/`VIDEO_MARK` in their constructors — those imports remain, just from `../../markers.js`.)

- [ ] **Step 5: Widen the core barrel — add substrate, move predicates**

In `packages/core/src/index.ts`:

Add near the top-level exports (a new block):

```ts
export {
  AUDIO_MARK,
  FONT_MARK,
  GROUP_MARK,
  isAudioNode,
  isVideoNode,
  MEDIA_MARK,
  TICK_MARK,
  VIDEO_MARK,
} from "./markers.js";
```

Change the signal export (line 56) from:

```ts
export type { ReadonlySignal } from "./engine/signal.js";
```

to:

```ts
export { createSignal, type ReadonlySignal, type Signal } from "./engine/signal.js";
```

Add the layout-engine helpers `Video` relies on (tag `@internal`, like `computeOffsets`) — place beside the existing `Flex`/`FlexShape` exports:

```ts
export {
  // @internal — flex sizing helpers reused by @smoove/media's Video node.
  applySize,
  type FlexilyNode,
  parseSize,
} from "./layout/flex/engine.js";
```

Update the audio/video export lines. Replace:

```ts
export { Audio, isAudioNode } from "./media/audio/index.js";
```

with (predicate now comes from `markers.js` above; `Audio` moves out in Task 3, so drop it here):

```ts
// Audio node moved to @smoove/media (Task 3). isAudioNode is exported from markers.js above.
```

Replace:

```ts
export { isVideoNode, Video } from "./media/video/index.js";
```

with:

```ts
// Video node moved to @smoove/media (Task 3). isVideoNode is exported from markers.js above.
```

Add `SeekMode` to the source-interface type exports. Change line 152:

```ts
export type { VideoSource, VideoSourceFactory } from "./media/video/video-source.js";
```

to:

```ts
export type { SeekMode, VideoSource, VideoSourceFactory } from "./media/video/video-source.js";
```

> **Note:** the concrete-source and config exports (`BrowserAudioSource`, `MediabunnyAudioSource`, `SchedulableAudioSource`, `BrowserVideoSource`, `MediabunnyVideoSource`, `AudioConfig`, `VideoConfig`) still point at files that exist in core right now, so leave them until Task 3 removes the files. This keeps Task 1 green.

- [ ] **Step 6: Build core to verify it stays green**

Run: `pnpm --filter @smoove/core build`
Expected: PASS (no errors). The barrel now exports the markers, `createSignal`/`Signal`, `SeekMode`, and the flex helpers; predicates resolve from `markers.ts`.

- [ ] **Step 7: Assert the substrate is actually exported**

Run:
```bash
node -e "const c=require('./packages/core/dist/index.js'); for (const k of ['MEDIA_MARK','AUDIO_MARK','VIDEO_MARK','TICK_MARK','FONT_MARK','GROUP_MARK','isAudioNode','isVideoNode','createSignal','applySize','parseSize']) if (c[k]===undefined) throw new Error('missing '+k); console.log('substrate OK');"
```
Expected: `substrate OK`

- [ ] **Step 8: Commit** (only if Rotem asks)

```bash
git add packages/core/src/markers.ts packages/core/src/engine packages/core/src/layout packages/core/src/media/audio/index.ts packages/core/src/media/video/index.ts packages/core/src/index.ts
git commit -m "refactor(core): promote marker leaf to core/markers.ts and widen public substrate"
```

---

## Task 2: Scaffold the empty `@smoove/media` package

Create the package skeleton and wire it into the workspace/build graph before moving any code, so Task 3's move lands into a buildable target. A stub barrel keeps this green.

**Files:**
- Create: `packages/media/package.json`, `packages/media/tsconfig.json`, `packages/media/src/index.ts`
- Modify: `tsconfig.json` (root), `.changeset/config.json`

- [ ] **Step 1: Create `packages/media/package.json`**

```json
{
  "name": "@smoove/media",
  "version": "0.2.0",
  "description": "Timeline-driven Audio and Video nodes for smoove, decoded with mediabunny.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/smoove-dev/smoove.git",
    "directory": "packages/media"
  },
  "homepage": "https://smoove.dev",
  "bugs": "https://github.com/smoove-dev/smoove/issues",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "clean": "rm -rf dist *.tsbuildinfo",
    "prepublishOnly": "pnpm build"
  },
  "peerDependencies": {
    "konva": ">=10"
  },
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {
    "@smoove/core": "workspace:^",
    "mediabunny": "^1.49.0"
  }
}
```

> `@smoove/core` is a **dependency**, not a peer — see the deviation note at the top of this plan. `mediabunny` moves here from core.

- [ ] **Step 2: Create `packages/media/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Create a stub `packages/media/src/index.ts`**

```ts
// Barrel filled in by Task 3.
export {};
```

- [ ] **Step 4: Register the project reference in root `tsconfig.json`**

Add to the `references` array (alphabetical-ish, next to `core`):

```json
    { "path": "./packages/media" },
```

- [ ] **Step 5: Add `@smoove/media` to the Changesets `fixed` group**

In `.changeset/config.json`, add `"@smoove/media"` to the single `fixed` array (order doesn't matter):

```json
  "fixed": [
    [
      "@smoove/code",
      "@smoove/core",
      "@smoove/media",
      "@smoove/player",
      "@smoove/transitions",
      "@smoove/renderer",
      "@smoove/studio",
      "@smoove/google-fonts",
      "@smoove/vite",
      "create-smoove"
    ]
  ],
```

- [ ] **Step 6: Install so pnpm links the new workspace package**

Run: `pnpm install`
Expected: lockfile updates, `@smoove/media` recognized as a workspace package, no errors.

- [ ] **Step 7: Build the empty package**

Run: `pnpm --filter @smoove/media build`
Expected: PASS (emits an empty `dist/index.js`).

- [ ] **Step 8: Commit** (only if Rotem asks)

```bash
git add packages/media tsconfig.json .changeset/config.json pnpm-lock.yaml
git commit -m "chore(media): scaffold empty @smoove/media package"
```

---

## Task 3: Move the media nodes/sources/drivers into `@smoove/media` and cut core's `mediabunny` dependency

The core of the extraction. Relocate the concrete trees, rewrite their cross-package imports to `@smoove/core`, write the real barrel + registration side-effect, then delete the core copies, neutralize core's runtime defaults, and drop `mediabunny` from core. After this task, `@smoove/core` and `@smoove/media` both build green; the in-repo *consumers* break until Task 4.

**Files:**
- Move (git mv, core → media): the 15 files listed in the File map "deleted (moved to media)".
- Create: real `packages/media/src/index.ts` (barrel + registration).
- Modify: `packages/core/src/engine/runtime-defaults.ts`, `packages/core/src/index.ts`, `packages/core/package.json`.

- [ ] **Step 1: Move the audio tree**

```bash
cd packages
mkdir -p media/src/audio media/src/video
git mv core/src/media/audio/index.ts              media/src/audio/index.ts
git mv core/src/media/audio/audio-source-browser.ts     media/src/audio/audio-source-browser.ts
git mv core/src/media/audio/audio-source-mediabunny.ts  media/src/audio/audio-source-mediabunny.ts
git mv core/src/media/audio/audio-driver.ts       media/src/audio/audio-driver.ts
git mv core/src/media/audio/audio-for-preview.ts  media/src/audio/audio-for-preview.ts
git mv core/src/media/audio/audio-for-rendering.ts media/src/audio/audio-for-rendering.ts
git mv core/src/media/audio/shared-audio-context.ts media/src/audio/shared-audio-context.ts
git mv core/src/media/audio/types.ts              media/src/audio/types.ts
cd ..
```

- [ ] **Step 2: Move the video tree**

```bash
cd packages
git mv core/src/media/video/index.ts              media/src/video/index.ts
git mv core/src/media/video/video-source-browser.ts    media/src/video/video-source-browser.ts
git mv core/src/media/video/video-source-mediabunny.ts media/src/video/video-source-mediabunny.ts
git mv core/src/media/video/driver.ts             media/src/video/driver.ts
git mv core/src/media/video/video-for-preview.ts  media/src/video/video-for-preview.ts
git mv core/src/media/video/video-for-rendering.ts media/src/video/video-for-rendering.ts
git mv core/src/media/video/types.ts              media/src/video/types.ts
cd ..
```

- [ ] **Step 3: Rewrite cross-package imports in the moved files**

Apply exactly these specifier rewrites (imported *names* are unchanged). Intra-media relative imports (to `./audio-driver.js`, `../audio/mixer.js`? — no, mixer stays in core; see below) are called out explicitly. **The core-retained leaves — `mixer.ts`, `asset.ts`, `media-time.ts`, `audio-source.ts`, `video-source.ts` — now live across the package boundary, so imports of them become `@smoove/core`.**

`media/src/audio/index.ts` — combine all core imports into one `@smoove/core` import:
- `"../../engine/composition.js"` (getComposition) → `"@smoove/core"`
- `"../../engine/environment.js"` (detectEnvironment, Environment, getEnvironment) → `"@smoove/core"`
- `"../../engine/runtime-defaults.js"` (getDefaultAudioSourceFactory) → `"@smoove/core"`
- `"../../engine/signal.js"` (createSignal, ReadonlySignal, Signal) → `"@smoove/core"`
- `"../../markers.js"` (AUDIO_MARK, MEDIA_MARK) → `"@smoove/core"`
- `"../media-time.js"` (MediaTiming) → `"@smoove/core"`
- `"./audio-source.js"` (AudioSource, AudioSourceFactory) → `"@smoove/core"`
- `"./mixer.js"` (AudioChannel, AudioMixer) → `"@smoove/core"`
- Keep relative: `"./audio-driver.js"`, `"./audio-for-preview.js"`, `"./audio-for-rendering.js"`, `"./types.js"`.

`media/src/video/index.ts`:
- `"../../engine/composition.js"` → `"@smoove/core"`
- `"../../engine/environment.js"` → `"@smoove/core"`
- `"../../engine/runtime-defaults.js"` (getDefaultVideoSourceFactory) → `"@smoove/core"`
- `"../../engine/signal.js"` → `"@smoove/core"`
- `"../../layout/contract.js"` (KMLayoutNode, LayoutBox) → `"@smoove/core"`
- `"../../layout/flex/engine.js"` (applySize, FlexilyNode, parseSize) → `"@smoove/core"`
- `"../../layout/flex/types.js"` (SizeValue) → `"@smoove/core"`
- `"../../layout/image.js"` (ObjectFit, ObjectPosition) → `"@smoove/core"`
- `"../markers.js"` (MEDIA_MARK, VIDEO_MARK) → `"@smoove/core"`
- `"../audio/mixer.js"` (AudioChannel, AudioMixer) → `"@smoove/core"`
- Keep relative: `"../audio/audio-driver.js"`, `"../audio/audio-for-preview.js"`, `"../audio/audio-for-rendering.js"`, `"../audio/audio-source-mediabunny.js"` (isSchedulable), `"./driver.js"`, `"./types.js"`, `"./video-for-preview.js"`, `"./video-for-rendering.js"`, `"./video-source.js"` (VideoSource, VideoSourceFactory) → **`"@smoove/core"`** (video-source.ts stayed in core).

`media/src/audio/audio-source-browser.ts`:
- `"./audio-source.js"` (AudioSource, SeekMode) → `"@smoove/core"`

`media/src/audio/audio-source-mediabunny.ts`:
- `"./audio-source.js"` (AudioSource, SeekMode) → `"@smoove/core"`
- Keep the `"mediabunny"` import.

`media/src/video/video-source-browser.ts`:
- `"./video-source.js"` (SeekMode, VideoSource) → `"@smoove/core"`

`media/src/video/video-source-mediabunny.ts`:
- `"./video-source.js"` (SeekMode, VideoSource) → `"@smoove/core"`
- Keep the `"mediabunny"` import.

`media/src/audio/audio-driver.ts`:
- `"../../engine/composition.js"` (Composition) → `"@smoove/core"`
- `"../media-time.js"` (MediaTiming) → `"@smoove/core"`
- `"./audio-source.js"` (AudioSource) → `"@smoove/core"`

`media/src/audio/audio-for-preview.ts`:
- `"../media-time.js"` (MediaTiming) → `"@smoove/core"`
- Keep `"mediabunny"` (WrappedAudioBuffer), `"./audio-driver.js"`, `"./audio-source-mediabunny.js"`, `"./shared-audio-context.js"`.

`media/src/audio/audio-for-rendering.ts`:
- `"../media-time.js"` (getMediaTime) → `"@smoove/core"`
- Keep `"./audio-driver.js"`.

`media/src/audio/shared-audio-context.ts`:
- `"../../engine/composition.js"` (Composition) → `"@smoove/core"`

`media/src/audio/types.ts`:
- `"./audio-source.js"` (AudioSourceFactory) → `"@smoove/core"`

`media/src/video/driver.ts`:
- `"../../engine/composition.js"` (Composition) → `"@smoove/core"`
- `"../media-time.js"` (getMediaTime, MediaTiming) → `"@smoove/core"`
- `"./video-source.js"` (VideoSource) → `"@smoove/core"`
- Keep the `export { getMediaTime };` re-export line — `video-for-preview.ts`/`video-for-rendering.ts` still import it from `./driver.js`.

`media/src/video/types.ts`:
- `"../../layout/flex/types.js"` (FlexChildProps, SizeValue) → `"@smoove/core"`
- `"../../layout/image.js"` (ObjectFit, ObjectPosition) → `"@smoove/core"`
- `"./video-source.js"` (VideoSourceFactory) → `"@smoove/core"`

`media/src/video/video-for-preview.ts` and `media/src/video/video-for-rendering.ts`:
- Only import `"./driver.js"` — no rewrite needed.

Sanity-check no stale relative reach-back remains:

```bash
grep -rnE "\.\./\.\./(engine|layout)|\.\./media-time|\.\./markers|\./(audio|video)-source\.js|\./mixer\.js" packages/media/src
# expect: no output (every cross-boundary path is now "@smoove/core")
```

- [ ] **Step 4: Write the real `packages/media/src/index.ts` (barrel + registration side-effect)**

```ts
/**
 * @smoove/media — timeline-driven Audio and Video nodes for smoove.
 *
 * Importing this module registers its browser `Mediabunny*` sources as
 * `@smoove/core`'s default source factories (the DI seam lives in core). A
 * server renderer (`@smoove/renderer`) overrides these with Node sources via
 * the same seam and does not import this package.
 */
import {
  setDefaultAudioSourceFactory,
  setDefaultVideoSourceFactory,
} from "@smoove/core";
import { MediabunnyAudioSource } from "./audio/audio-source-mediabunny.js";
import { MediabunnyVideoSource } from "./video/video-source-mediabunny.js";

setDefaultAudioSourceFactory(() => new MediabunnyAudioSource());
setDefaultVideoSourceFactory(() => new MediabunnyVideoSource());

export { Audio } from "./audio/index.js";
export { BrowserAudioSource } from "./audio/audio-source-browser.js";
export {
  MediabunnyAudioSource,
  type SchedulableAudioSource,
} from "./audio/audio-source-mediabunny.js";
export type { AudioConfig } from "./audio/types.js";
export { Video } from "./video/index.js";
export { BrowserVideoSource } from "./video/video-source-browser.js";
export { MediabunnyVideoSource } from "./video/video-source-mediabunny.js";
export type { VideoConfig } from "./video/types.js";

// Typed guards that narrow to this package's concrete nodes (authoring
// ergonomics). Core's isAudioNode/isVideoNode return plain boolean.
import type Konva from "konva";
import { isAudioNode as _isAudioNode, isVideoNode as _isVideoNode } from "@smoove/core";
import type { Audio as _Audio } from "./audio/index.js";
import type { Video as _Video } from "./video/index.js";

export const isAudioNode = (node: Konva.Node): node is _Audio => _isAudioNode(node);
export const isVideoNode = (node: Konva.Node): node is _Video => _isVideoNode(node);
```

- [ ] **Step 5: Neutralize core's `runtime-defaults.ts`**

In `packages/core/src/engine/runtime-defaults.ts`:

Delete the two `Mediabunny*` imports (lines 11 and 13):

```ts
import { MediabunnyAudioSource } from "../media/audio/audio-source-mediabunny.js";
import { MediabunnyVideoSource } from "../media/video/video-source-mediabunny.js";
```

Change the two default-factory initializers (lines 68-69) from:

```ts
let videoFactory: VideoSourceFactory = (): VideoSource => new MediabunnyVideoSource();
let audioFactory: AudioSourceFactory = (): AudioSource => new MediabunnyAudioSource();
```

to a throwing default that guides the developer:

```ts
function unregisteredSource(kind: "Audio" | "Video"): never {
  throw new Error(
    `[smoove] No default ${kind} source factory registered. In the browser, ` +
      `import "@smoove/media" before constructing a composition; on the server, ` +
      `call setDefault${kind}SourceFactory() (e.g. @smoove/renderer's setup).`,
  );
}

let videoFactory: VideoSourceFactory = (): VideoSource => unregisteredSource("Video");
let audioFactory: AudioSourceFactory = (): AudioSource => unregisteredSource("Audio");
```

Update the file's opening doc comment (lines 5-7) to stop naming the moved classes:

```ts
 * is constructed (e.g. `@smoove/renderer`'s `setupServerRendering()`). In the
 * browser, importing `@smoove/media` registers its `Mediabunny*` sources; until
 * a factory is registered the defaults throw with guidance.
```

(The `AudioSource`/`VideoSource` type imports on line 10/12 stay — they annotate the factory return types.)

- [ ] **Step 6: Finish the core barrel — remove the moved node/source/config exports**

In `packages/core/src/index.ts`, delete these now-dangling export lines (the files no longer exist in core):

```ts
export { BrowserAudioSource } from "./media/audio/audio-source-browser.js";
export {
  MediabunnyAudioSource,
  type SchedulableAudioSource,
} from "./media/audio/audio-source-mediabunny.js";
export type { AudioConfig } from "./media/audio/types.js";
export { BrowserVideoSource } from "./media/video/video-source-browser.js";
export { MediabunnyVideoSource } from "./media/video/video-source-mediabunny.js";
export type { VideoConfig } from "./media/video/types.js";
```

Also delete the two comment placeholders left in Task 1 Step 5 (the `// Audio node moved…` / `// Video node moved…` lines) — they've served their purpose. Keep `AudioAsset`, `AudioSource`/`AudioSourceFactory`, `AudioMixer`/`AudioChannel`, `getMediaTime`/`MediaTiming`, `SeekMode`/`VideoSource`/`VideoSourceFactory` — those files stayed in core.

- [ ] **Step 7: Remove `mediabunny` from core's `package.json`**

In `packages/core/package.json`, delete the dependency line:

```json
    "mediabunny": "^1.49.0"
```

(Leave `bezier-easing` and `flexily`.)

- [ ] **Step 8: Reinstall (core drops mediabunny, media gains it)**

Run: `pnpm install`
Expected: lockfile updates; `mediabunny` no longer a direct dep of `@smoove/core`.

- [ ] **Step 9: Build core, then media**

Run: `pnpm --filter @smoove/core build && pnpm --filter @smoove/media build`
Expected: both PASS. Core no longer references any moved file; media resolves all its `@smoove/core` imports against the widened barrel.

- [ ] **Step 10: Assert core is mediabunny-free**

Run:
```bash
grep -rn "mediabunny" packages/core/src packages/core/dist packages/core/package.json && echo "FAIL: mediabunny still in core" || echo "core is mediabunny-free"
```
Expected: `core is mediabunny-free`

- [ ] **Step 11: Assert a media-free composition still constructs in core alone**

Run:
```bash
node -e "const {Composition}=require('./packages/core/dist/index.js'); console.log(typeof Composition==='function' ? 'core standalone OK':'FAIL');"
```
Expected: `core standalone OK`

- [ ] **Step 12: Commit** (only if Rotem asks)

```bash
git add packages/core packages/media pnpm-lock.yaml
git commit -m "feat(media): extract Audio/Video nodes into @smoove/media; drop mediabunny from core"
```

---

## Task 4: Repoint every in-repo consumer to `@smoove/media`

Core's barrel no longer exports `Audio`/`Video`/concrete sources/configs, so the four packages that author media must import them from `@smoove/media` and declare the dependency. `@smoove/renderer`'s `src/` is untouched (it uses only `isAudioNode`/`isVideoNode`, which stayed in core) — only its `examples/` need the dep.

**Files:**
- Modify: `packages/renderer/package.json`, `packages/renderer/examples/audio-mixer.ts`, `packages/renderer/examples/render-demo.ts`
- Modify: `packages/docs/package.json`, `packages/docs/src/demos/audio-mixer.ts`, `packages/docs/src/demos/video-sync.ts`
- Modify: `packages/kitchen-sink/package.json`, `packages/kitchen-sink/src/compositions/audio-mixer/composition.ts`, `cohabit/composition.ts`, `transitions/_shared.ts`, `video-sync/composition.ts`

- [ ] **Step 1: Renderer examples — add dev dep + split imports**

In `packages/renderer/package.json`, add to `devDependencies` (create the block if absent):

```json
    "@smoove/media": "workspace:^"
```

In `packages/renderer/examples/audio-mixer.ts`, change line 17 from:

```ts
import { Audio, Composition, interpolate, interpolateColors, Sequence, Video } from "@smoove/core";
```

to:

```ts
import { Composition, interpolate, interpolateColors, Sequence } from "@smoove/core";
import { Audio, Video } from "@smoove/media";
```

In `packages/renderer/examples/render-demo.ts`, change line 15 from:

```ts
import { Audio, Composition, Image, interpolate, Sequence } from "@smoove/core";
```

to:

```ts
import { Composition, Image, interpolate, Sequence } from "@smoove/core";
import { Audio } from "@smoove/media";
```

- [ ] **Step 2: Docs demos — add dep + split imports**

In `packages/docs/package.json`, add to `dependencies`:

```json
    "@smoove/media": "workspace:*",
```

In `packages/docs/src/demos/audio-mixer.ts`, change line 1 from:

```ts
import { Audio, Composition, interpolate, interpolateColors, Sequence } from "@smoove/core";
```

to:

```ts
import { Composition, interpolate, interpolateColors, Sequence } from "@smoove/core";
import { Audio } from "@smoove/media";
```

In `packages/docs/src/demos/video-sync.ts`, change line 1 from:

```ts
import { Composition, Sequence, Video } from "@smoove/core";
```

to:

```ts
import { Composition, Sequence } from "@smoove/core";
import { Video } from "@smoove/media";
```

- [ ] **Step 3: Kitchen-sink compositions — add dep + split imports**

In `packages/kitchen-sink/package.json`, add to `dependencies`:

```json
    "@smoove/media": "workspace:*",
```

In `packages/kitchen-sink/src/compositions/audio-mixer/composition.ts`, change line 1 from:

```ts
import { Audio, Composition, interpolate, interpolateColors, Sequence } from "@smoove/core";
```

to:

```ts
import { Composition, interpolate, interpolateColors, Sequence } from "@smoove/core";
import { Audio } from "@smoove/media";
```

In `packages/kitchen-sink/src/compositions/cohabit/composition.ts`, remove `Audio` and `Video` from the `@smoove/core` import block (lines 1-11), leaving:

```ts
import {
  Block,
  Composition,
  Easing,
  interpolate,
  Sequence,
  type ShadowProps,
} from "@smoove/core";
import { Audio, Video } from "@smoove/media";
import Konva from "konva";
```

In `packages/kitchen-sink/src/compositions/transitions/_shared.ts`, change line 23 from:

```ts
import { Composition, type Sequence, Video } from "@smoove/core";
```

to:

```ts
import { Composition, type Sequence } from "@smoove/core";
import { Video } from "@smoove/media";
```

In `packages/kitchen-sink/src/compositions/video-sync/composition.ts`, change line 1 from:

```ts
import { Composition, Sequence, Video } from "@smoove/core";
```

to:

```ts
import { Composition, Sequence } from "@smoove/core";
import { Video } from "@smoove/media";
```

- [ ] **Step 4: Confirm no stray media imports from core remain (code only)**

Run:
```bash
grep -rnE "\b(Audio|Video|AudioConfig|VideoConfig|BrowserAudioSource|MediabunnyAudioSource|BrowserVideoSource|MediabunnyVideoSource)\b[^\n]*from \"@smoove/core\"" packages templates --include='*.ts' --include='*.tsx' | grep -v /dist/
# expect: no output
```

(Docs content — `*.mdx`/`*.md` in `packages/docs/content`, `doc/`, `skills/` — is repointed in Task 6, which ends with its own repo-wide sweep covering those extensions.)

- [ ] **Step 5: Reinstall to link the new deps**

Run: `pnpm install`
Expected: `@smoove/media` linked into renderer (dev), docs, kitchen-sink.

- [ ] **Step 6: Full workspace typecheck/build**

Run: `pnpm -r build`
Expected: PASS across all packages. (Docs/kitchen-sink are app builds; if a package uses `tsc --noEmit` for checks, that passes too.)

- [ ] **Step 7: Commit** (only if Rotem asks)

```bash
git add packages/renderer packages/docs packages/kitchen-sink pnpm-lock.yaml
git commit -m "refactor: repoint in-repo consumers to @smoove/media"
```

> **Templates verified clean:** `templates/{composition-js,composition-ts,shared,studio}` were grepped for `new Audio(`/`new Video(` and `@smoove/core` media imports — none author media (matches the spec's expectation). No template changes are needed.

---

## Task 5: Verification — render regression, browser playback, mediabunny-free proof

Prove the extraction is behavior-preserving using the spec's four checks. These renderer examples produced an mp4 with audio + a still on `main` (verified 2026-07-18) — that's the before/after baseline.

**Files:** none modified (verification only).

- [ ] **Step 1: Core-has-no-mediabunny (re-confirm post-consumer-repoint)**

Run:
```bash
grep -rn "mediabunny" packages/core/src packages/core/dist packages/core/package.json && echo "FAIL" || echo "core mediabunny-free OK"
```
Expected: `core mediabunny-free OK`

- [ ] **Step 2: Renderer regression — video+audio render**

Run: `pnpm --filter @smoove/renderer example`
Expected: completes without error and writes an mp4 (same output path as on `main`). Confirm the file exists and is non-empty:
```bash
ls -la packages/renderer/*.mp4 2>/dev/null || ls -la packages/renderer/out* 2>/dev/null
```
(Use whatever output path `render-demo.ts` writes — inspect the script's output filename if unsure.)

- [ ] **Step 3: Renderer regression — audio mixer render**

Run: `pnpm --filter @smoove/renderer example:mixer`
Expected: completes and writes an mp4 with mixed audio, unchanged from baseline.

- [ ] **Step 4: Renderer media probe still compiles against core**

`render.ts`'s `isAudioNode`/`isVideoNode` import from `@smoove/core` must still typecheck (the predicates stayed in core). Confirm via the renderer build:

Run: `pnpm --filter @smoove/renderer build`
Expected: PASS (no missing-export error for `isAudioNode`/`isVideoNode`).

- [ ] **Step 5: Browser playback — kitchen-sink**

Launch kitchen-sink (studio dev app on :5190 per [[kitchen-sink-app]]) and load the `audio-mixer` and `video-sync` compositions. Use the preview browser tools:
1. `preview_start` the kitchen-sink dev server.
2. Navigate to the `audio-mixer` composition; scrub/play; `read_console_messages` for errors (ignore the known null-React hydration spam per [[kitchen-sink-app]]).
3. Navigate to the `video-sync` composition; confirm the video frames advance with the timeline.
4. `computer {action:"screenshot"}` of each playing to capture proof.

Expected: both play/scrub correctly; the `@smoove/media` entry side-effect has registered the browser sources (no "No default source factory registered" error in the console).

- [ ] **Step 6: (No commit — verification only.)**

---

## Task 6: Changeset + docs/skill import-path updates

Record the breaking change and repoint every doc surface that still shows `@smoove/core` media imports: the smoove-video skill rule, the two public docs pages (`audio.mdx`/`video.mdx`), and `doc/README.md`.

**Files:**
- Create: `.changeset/<name>.md`
- Modify: `skills/smoove-video/rules/media.md` (and its `.agents/skills/smoove-video/rules/media.md` mirror — verified present)
- Modify: `packages/docs/content/docs/audio.mdx`, `packages/docs/content/docs/video.mdx`
- Modify: `doc/README.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/media-package-extraction.md`:

```markdown
---
"@smoove/core": minor
"@smoove/media": minor
---

Extract the `Audio` and `Video` nodes (and their `mediabunny` decoders) into a
new `@smoove/media` package. `@smoove/core` no longer depends on `mediabunny`
(~10 MB) and no longer exports `Audio`, `Video`, `AudioConfig`, `VideoConfig`,
`BrowserAudioSource`, `MediabunnyAudioSource`, `BrowserVideoSource`, or
`MediabunnyVideoSource`.

**Migration:** import media authoring from `@smoove/media` and add it as a
dependency:

```ts
// before
import { Audio, Video } from "@smoove/core";
// after
import { Audio, Video } from "@smoove/media";
```

Importing `@smoove/media` (browser) auto-registers its sources. `isAudioNode` /
`isVideoNode` remain exported from `@smoove/core`. `@smoove/renderer` is
unchanged for correctly-importing apps.
```

> The `fixed` group propagates this minor to the whole set (target 0.3.0). Because `@smoove/core` is a real `dependency` of the siblings (not a peer), no `1.0.0` escalation occurs — see [[changesets-fixed-peer-major-escalation]].

- [ ] **Step 2: Flag the one-time trusted-publisher registration**

`@smoove/media` is a brand-new package on npm. Per `RELEASING.md`, first publish needs a one-time trusted-publisher (OIDC) registration for the new package name. **This is a maintainer action for Rotem — surface it in the handoff; do not attempt it.**

- [ ] **Step 3: Update the smoove-video skill media rule**

In `skills/smoove-video/rules/media.md`, change the two media import examples:
- Line ~32: `import { Audio } from "@smoove/core";` → `import { Audio } from "@smoove/media";`
- Line ~63: `import { Video } from "@smoove/core";` → `import { Video } from "@smoove/media";`

Leave the `Image` example (`import { Image } from "@smoove/core";`) as-is — `Image` stays in core. Add a one-line note under the Audio/Video heading:

```markdown
> `Audio`/`Video` ship in `@smoove/media` (they pull in `mediabunny`); `Image`
> stays in `@smoove/core`. Add `@smoove/media` as a dependency to use them.
```

Apply the identical edits to the mirror at `.agents/skills/smoove-video/rules/media.md` (verified to exist).

- [ ] **Step 4: Repoint the public docs pages (`audio.mdx`, `video.mdx`)**

In `packages/docs/content/docs/audio.mdx`, change line 13 from:

```ts
import { Audio, Composition, Sequence } from "@smoove/core";
```

to:

```ts
import { Composition, Sequence } from "@smoove/core";
import { Audio } from "@smoove/media";
```

(The second snippet's `import { interpolate } from "@smoove/core";` at line 51 is correct as-is.)

In `packages/docs/content/docs/video.mdx`, change line 12 from:

```ts
import { Composition, Sequence, Video } from "@smoove/core";
```

to:

```ts
import { Composition, Sequence } from "@smoove/core";
import { Video } from "@smoove/media";
```

In each page, add a short install note near the top (after the intro paragraph, matching the page's existing Callout/prose style), e.g.:

```
`Audio` ships in the `@smoove/media` package (it pulls in the mediabunny
decoder): `pnpm add @smoove/media`.
```

(same for `Video` on video.mdx). Skim each page for any other `Audio`/`Video` import line — the grep found only these two, but eyeball the surrounding prose for "from `@smoove/core`" claims about the media nodes.

- [ ] **Step 5: Repoint `doc/README.md`**

Three touch points (verified by grep):
- Line 832 prose: "`@smoove/core` ships an `Audio` node for timeline-driven sound" → "`@smoove/media` ships an `Audio` node …" (add a clause noting it's a separate package from core).
- Line 840: `import { Composition, Sequence, Audio } from "@smoove/core";` → split into core + `import { Audio } from "@smoove/media";`.
- Line 1006 (renderer example block): `import { Composition, Sequence, Audio } from "@smoove/core";` → same split. Keep the `import "@smoove/renderer/register";` line above it first — registration order is unaffected because nodes read the source factory at construction time, not import time.

Leave `installation.mdx` and `rendering/media.mdx` untouched (verified: no media-node imports from core; `rendering/media.mdx`'s `MediabunnyVideoSource` is the renderer's own Node source).

- [ ] **Step 6: Final repo-wide sweep — no doc or code surface still imports media from core**

Run:
```bash
grep -rnE "import[^\n]*\b(Audio|Video)\b[^\n]*from \"@smoove/core\"" packages templates skills doc .agents --include='*.ts' --include='*.tsx' --include='*.md' --include='*.mdx' | grep -v /dist/ | grep -vE "docs/superpowers/"
# expect: no output
```

- [ ] **Step 7: Commit** (only if Rotem asks)

```bash
git add .changeset/media-package-extraction.md skills/smoove-video/rules/media.md .agents/skills/smoove-video/rules/media.md packages/docs/content/docs/audio.mdx packages/docs/content/docs/video.mdx doc/README.md
git commit -m "docs(media): changeset + import-path updates for @smoove/media"
```

---

## Cross-cutting notes

- **DI across the global boundary (standalone player / docs):** `@smoove/vite` externalizes only `@smoove/core` and `konva` to `window.Smoove`/`window.Konva`; it *bundles* sibling packages like `@smoove/media`. A demo's bundled `@smoove/media` resolves its internal `@smoove/core` imports to the same `window.Smoove` singleton, so its registration side-effect writes into the one shared `runtime-defaults` — the seam works across the boundary. Side effect: `mediabunny` now rides in the demo bundle instead of the core global (a size shift, not a regression). Task 5 Step 5 exercises this path.
- **Renderer examples vs the media entry side-effect (import ordering):** in the repointed renderer examples, `import { Audio } from "@smoove/media"` registers the *browser* Mediabunny factories at import time — before the module body calls `setupServerRendering()` (ESM imports are hoisted). This is safe: nodes read `getDefault*SourceFactory()` at **construction** time, and `new Audio(...)`/`new Video(...)` happen after setup, so the renderer's Node factories win. Do not "fix" the import order; just never construct a media node before setup in a Node script.
- **`@smoove/renderer` is deliberately untouched in `src/`:** it owns its Node `MediabunnyVideoSource`/`NullAudioSource` and the mux pipeline, all of which stay. Consolidating those into a `@smoove/media` server subpath is an explicit follow-up, out of scope here.
- **Out of scope (per spec):** audio envelope/amplitude introspection; deleting the inert legacy `BrowserAudioSource` (it moves as-is).
