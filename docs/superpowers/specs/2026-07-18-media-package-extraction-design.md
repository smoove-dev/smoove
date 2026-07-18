# `@smoove/media` — extracting media nodes out of core

Date: 2026-07-18
Type: design / spec. Approved in brainstorming on 2026-07-18.
Status: **design approved, not yet implemented.** Next step: implementation plan.

Companion to `2026-07-18-media-audio-text-api-triage.md` (roadmap item 4). This
is the full-separation variant, not the minimal-churn "lift only the concrete
sources" variant the triage sketched — the decision was to make media a **truly
separate package**.

## Goal

Drop `mediabunny` (~10 MB installed) from `@smoove/core` **entirely** — both the
browser bundle and the install footprint — by moving the media *nodes* and their
concrete decoders into a new `@smoove/media` package. Core becomes a media-*aware*
engine with no media *implementation* and no `mediabunny` dependency.

## Why this is feasible (the seam already exists)

The engine never imports the `Audio`/`Video` classes. It discovers media purely
by marker string and drives it through optional interface methods:

- `engine/composition.ts`: `l.find(n => n.getAttr(MEDIA_MARK) === true)` →
  `this.mixer.register(v as AudioChannel)`; `_forEachMedia(n => n._kmSuspend?.())`.
- `engine/sequence.ts`: ticks nodes found by `MEDIA_MARK`/`TICK_MARK`, calling
  `_kmTick`.

`media/media-marker.ts` was deliberately built as a dependency-free leaf "so
`composition.ts` can discover media by string without importing `video/`/`audio/`
(avoiding an import cycle)." This design realizes that intent — and the same
string-tag mechanism is why an external `@smoove/media` node is still discoverable.

The only `media/` imports reaching into `engine/` are node-agnostic and
mediabunny-free: `mixer.ts` (`AudioMixer`/`AudioChannel`), `asset.ts`
(`AudioAsset`), the markers leaf. No cycle results: **media → core only.**

## Generalize the marker system (rename out of `media/`)

The markers leaf is misnamed. Despite living at `media/media-marker.ts` it is not
media-specific — it already defines `TICK_MARK` (typewriter `Text`), `FONT_MARK`
(`Font`), and `GROUP_MARK` (the `Group` container), alongside `MEDIA_MARK`/
`AUDIO_MARK`/`VIDEO_MARK`. It is the engine's general **node-marker contract**:
string attrs stamped on Konva nodes so the engine and tooling can discover and
classify nodes by string, without importing the node classes (dodging import
cycles) — a sibling of `layout/contract.ts` (the `KMLayoutNode` contract).

As part of this work, promote it to a general, top-level home:

- Move `media/media-marker.ts` → `core/src/markers.ts` (a neutral cross-cutting
  leaf; `engine/markers.ts` is the fallback if we'd rather group it with its
  primary consumer).
- Rewrite the file doc from "Marker attrs stamped on media nodes (Video, Audio)…"
  to the general framing above.
- Keep every constant name as-is (`MEDIA_MARK`, `AUDIO_MARK`, `VIDEO_MARK`,
  `TICK_MARK`, `FONT_MARK`, `GROUP_MARK`) — only the file/module is renamed.
- Update all importers (mechanical): `engine/sequence.ts`, `engine/composition.ts`,
  `layout/image.ts`, `layout/text/text.ts`, `layout/text/font.ts`,
  `layout/group.ts`, plus the `audio/`+`video/` trees as they move to
  `@smoove/media`.
- Export the constants from core's barrel as public substrate (see below), since
  `@smoove/media` now consumes them across a package boundary.

This is an independent, low-risk rename; it can land as a prep commit before the
node move, or within the same branch.

## Boundary — what stays vs moves

### Stays in `@smoove/core` (no `mediabunny`)

- Entire `engine/` and `layout/` (incl. `Image` — it's layout, uses the
  `ImageLoader` DI seam, not `mediabunny`).
- The general **node-marker** leaf, renamed `media/media-marker.ts` →
  `core/src/markers.ts` (see "Generalize the marker system" above).
- `media/media-time.ts` — `getMediaTime` / `MediaTiming` (pure).
- `media/audio/asset.ts` — `AudioAsset` (plain data type; renderer reads it via
  `comp.getAudioAssets()`).
- `media/audio/mixer.ts` — `AudioMixer` + `AudioChannel` interface. `comp.mixer`
  stays on `Composition` (decision: mixer is node-agnostic and part of the core
  API). External nodes implement core's `AudioChannel`.
- The source **interfaces** + DI seam: `media/audio/audio-source.ts`
  (`AudioSource`), `media/video/video-source.ts` (`VideoSource`, `SeekMode`),
  and `runtime-defaults.ts`'s `setDefault*SourceFactory`/`getDefault*SourceFactory`.
- **The `isAudioNode` / `isVideoNode` predicates.** They are pure mark checks
  (`getAttr(AUDIO_MARK) === true`) with no runtime dependency on the classes, so
  they move to core alongside the marks. Their return type narrows to a small
  core structural interface (or `boolean`) rather than the moved class.
  `@smoove/renderer` imports these as *values* (`render.ts:52`, a boolean
  "does this comp contain media?" filter) — keeping them in core is what stops
  the renderer from breaking. `@smoove/media` may re-export typed guards that
  narrow to its concrete `Audio`/`Video` for authoring ergonomics.

These `media/*` leaves may move under a core-internal folder (e.g. keep the paths,
just stop the barrel from exporting nodes) — internal relocation is free since the
barrel is the only public entry.

### Moves to `@smoove/media` (depends on `@smoove/core` + `mediabunny`)

- `media/audio/index.ts` → the `Audio` node (but **not** `isAudioNode` — that
  mark-based predicate stays in core; see above).
- `media/video/index.ts` → the `Video` node (but **not** `isVideoNode`).
- Concrete sources: `audio-source-browser.ts`, `audio-source-mediabunny.ts`,
  `video-source-browser.ts`, `video-source-mediabunny.ts`.
- Drivers: `audio-driver.ts`, `audio-for-preview.ts`, `audio-for-rendering.ts`,
  `video/driver.ts`, `video/video-for-preview.ts`, `video/video-for-rendering.ts`,
  `shared-audio-context.ts`.
- Config types: `AudioConfig`, `VideoConfig`.

## Defaults & registration

- The DI seam stays in core. `@smoove/media`'s `Audio`/`Video` default their
  source to `getDefaultAudioSourceFactory()` / `getDefaultVideoSourceFactory()`.
- Importing `@smoove/media` sets those defaults to its browser `Mediabunny*`
  sources (side-effect on the package's entry, or a `@smoove/media/register`
  subpath — decide in the plan; prefer entry side-effect for zero-ceremony DX).
- `@smoove/renderer` keeps calling `setDefault*SourceFactory` for Node exactly as
  today (`setup.ts` → `nodeVideoSourceFactory` / `nullAudioSourceFactory`). **No
  behavior change for correctly-importing apps.**

## Core public-surface change

Nodes lean on currently-*internal* core APIs. To let a sibling package author
nodes, core must export the substrate:

- Mark constants from the renamed `markers.ts`: `MEDIA_MARK`, `AUDIO_MARK`,
  `VIDEO_MARK`, `TICK_MARK`, `FONT_MARK`, `GROUP_MARK` (currently unexported).
- `createSignal` / `Signal` (currently only `ReadonlySignal` is exported).
- Driver-context types the nodes/drivers share.
- Already public and reused as-is: `getComposition`, `detectEnvironment`/
  `getEnvironment`, the runtime-defaults seam, `AudioMixer`/`AudioChannel`,
  `AudioAsset`, `getMediaTime`/`MediaTiming`, `AudioSource`/`VideoSource`.

Decision for the plan: expose these from the main barrel vs a `@smoove/core/internal`
subpath. Lean toward the barrel — they are legitimately public once an official
sibling consumes them — unless the surface feels too large, then subpath.

## Migration & breakage (accepted)

Breaking: media authoring moves from `@smoove/core` to `@smoove/media`. Core's
barrel stops exporting `Audio`/`Video`/`isAudioNode`/`isVideoNode`/the source
classes/`AudioConfig`/`VideoConfig`.

In-repo consumers to repoint (import from `@smoove/media`, add the dep):

- `packages/docs/src/demos/audio-mixer.ts`, `video-sync.ts`
- `packages/kitchen-sink/src/compositions/audio-mixer`, `cohabit`,
  `transitions/_shared.ts`, `video-sync`
- `packages/renderer/examples/audio-mixer.ts`, `render-demo.ts`
- `templates/*` if any author `Video`/`Audio` (verify; `templates/shared/
  composition.ts` did not show up in the grep).

`@smoove/renderer` itself needs **no** node import — it drives compositions
generically and reads `comp.getAudioAssets()` (core). It depends on core, not
media.

Versioning: smoove is `0.1.x` alpha → a `fixed`-group minor bump. Add
`@smoove/media` to the `fixed` group in `.changeset/config.json`; flag the
one-time trusted-publisher registration for the maintainer (per `RELEASING.md`).
Changeset carries the migration note. Update `skills/smoove-video/rules/media.md`
and docs to the new import path.

## `@smoove/renderer` — in scope

The renderer is the server-side media consumer, so the extraction must define and
verify its post-move relationship (not punt it). Its coupling to core, from
`grep`:

- `render.ts` imports `isAudioNode`/`isVideoNode` as **values** — a boolean media
  probe. **Fix:** those predicates stay in core (above), so this import is
  unchanged. This is a hard constraint on the extraction, not a nicety.
- Type-only, all staying in core: `AudioAsset`, `Composition` (`audio-track.ts`,
  `probe.ts`, `types.ts`), `LoadedImage` (`image-loader.ts`), `FontFaceDescriptor`/
  `FontLoader` (`font-loader.ts`), `VideoSource`/`VideoSourceFactory`/`Environment`
  (`video-source-mediabunny.ts`), `AudioSource`/`AudioSourceFactory`
  (`audio-source-null.ts`).
- `setup.ts` uses the DI seam (`setDefault*SourceFactory`) — stays in core.

So after the move the renderer **imports nothing that relocates** and needs no
new dependency on `@smoove/media`. It keeps driving compositions generically and
reading `comp.getAudioAssets()`.

The renderer owns its **own** Node sources — `video-source-mediabunny.ts`
(`MediabunnyVideoSource`, Node analogue) and `audio-source-null.ts`
(`NullAudioSource`) — plus the mux pipeline (`audio-mix.ts`, `encode.ts`) that
decodes with `mediabunny` directly and reads `AudioAsset`. **Decision for this
extraction: leave these in `@smoove/renderer` as-is** (it already deps
`mediabunny`/`@mediabunny/server`, they work, and moving them buys nothing here).
Consolidating all mediabunny sources into a `@smoove/media` server subpath is a
possible follow-up, explicitly out of scope for this pass.

Net: the mux pipeline is functionally untouched, but the renderer is **in scope**
for (a) the predicate-placement constraint and (b) verification below.

## Package shape

```
packages/media
  package.json      name @smoove/media; peer: @smoove/core, konva; dep: mediabunny
  tsconfig.json     composite, project-ref → core
  src/index.ts      barrel: Audio, Video, isAudioNode, isVideoNode,
                    Browser*/Mediabunny* sources, AudioConfig, VideoConfig
  src/...           the moved audio/ + video/ trees
```

Build with `tsc -b` (like every package except player). Emits `dist/`, publishes
via `exports`.

## Verification

- **Headless render smoke** (renderer + a comp using `@smoove/media` `Audio`/
  `Video`): assert the factory swap works and `comp.getAudioAssets()` records
  (mirrors the smoke used for the audio trim/gain work).
- **Core-has-no-mediabunny check**: `@smoove/core`'s built `dist` and
  `package.json` contain no `mediabunny` reference; core builds and a
  media-free composition renders.
- **Browser check** in kitchen-sink: the `audio-mixer` and `video-sync`
  compositions play/scrub correctly after repointing imports.
- **Renderer regression** (required — render is in scope): after the move,
  `pnpm --filter @smoove/renderer example` and `example:mixer` still produce an
  mp4 with audio + a still, unchanged. These pass on `main` today (verified
  2026-07-18), so they are the before/after baseline. `render.ts`'s media probe
  (`isAudioNode`/`isVideoNode`) must still compile against core.

## Out of scope

- Audio envelope/amplitude introspection (triage #1) — separate, later.
- The inert legacy `BrowserAudioSource` (the preview driver is sink-only, so it
  no longer plays): it moves with the rest for now; deleting it is a separate
  cleanup, not this extraction.
- **Consolidating the renderer's Node sources** (`MediabunnyVideoSource`,
  `NullAudioSource`) into a `@smoove/media` server subpath — a possible follow-up.
  The renderer is otherwise **in scope** (see its section): its imports and a
  render regression are part of this work; the mux internals just don't change.

## Open decisions deferred to the plan

1. Register via package entry side-effect vs `@smoove/media/register` subpath.
2. Substrate exposure via main barrel vs `@smoove/core/internal`.
3. Whether the moved `media/*` core-retained leaves get relocated (e.g. into
   `engine/` or a new `core/src/media-contract/`) or keep their paths internally.
