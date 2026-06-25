# Docs Update — Fonts, Google Fonts, Mediabunny Media, Dynamic Props

**Date:** 2026-06-25
**Scope:** Full audit of all 24 doc pages + new content for three feature areas, with runnable demos for the new features.

## Goal

Bring `@konva-motion/docs` up to date with recent additions and fix pages that
"miss the point":

- **Fonts** — the `Font` node + loading model (new, undocumented).
- **Google Fonts** — `@konva-motion/google-fonts` package (new, undocumented).
- **Media via mediabunny** — `video`/`audio`/rendering pages predate the
  mediabunny migration and are now factually wrong in places.
- **Dynamic props** — the first-class composition `props` system has zero
  conceptual coverage. This is the headline gap.

## Audit findings

### Stale / factually wrong (mediabunny migration)

- `rendering.mdx` — quality table still documents x264 CRF + presets
  (`veryfast`/`fast`/…); mediabunny uses bitrate constants
  (`QUALITY_LOW…QUALITY_VERY_HIGH`). Missing WebM (`format: "webm"`) support.
- `rendering-media.mdx` — describes an ffmpeg `amix` audio pipeline and an
  "ffmpeg streaming decoder"; both are now in-process Mediabunny
  (`mixAudio()` + `AudioSampleSink` → `MediabunnyEncoder`). Remote font URLs +
  `fontCacheDir` (auto-download + cache) are undocumented.
- `audio.mdx` — render-path callout says ffmpeg muxes audio; now in-process.
  Video soundtracks now play (were silent pre-migration).
- `video.mdx` — implies `<video>`/skia decode; both preview and render now use
  Mediabunny pull-based frame-accurate seeking. Soundtracks play.

### Missing entirely

- **Fonts** — `Font` node (invisible `Konva.Group`, added via `seq.add(font)`),
  composition buffer-gated loading (nothing renders/flashes until fonts load),
  `Text`'s `font?: Font | FontFaceRef` prop (not even listed in `text.mdx`),
  `font.face()` selection, browser `FontFace` vs server skia loader.
- **Google Fonts** — `@konva-motion/google-fonts`: per-family import
  (`import Roboto from "@konva-motion/google-fonts/roboto"`),
  `{ weights, styles, subset }`, tree-shaking via wildcard subpath exports.
- **Dynamic props** — `new Composition({ props })`, reading `comp.props.get()`
  **live inside updaters**, `comp.setProps(next | (prev) => next)`,
  `comp.refresh()`, and `player.setProps()`. `introduction.mdx` only reads props
  at construction time, which misses the point of a reactive props signal.

### Solid — leave alone

`easing`, `shapes`, `images`, `flex`, `block`, `transitions`,
`transitions-setup`, `player-setup`. (`installation` needs only a minor props
mention.)

## Decisions

- **Fonts nav:** new `---Fonts---` section after `---Layout---`, before
  `---Media---`, with two pages: `fonts`, `google-fonts`.
- **Dynamic props page:** new `dynamic-props` page in Getting Started, right
  after `core-concepts` (foundational; player/studio/rendering all build on it,
  and other pages link back to one canonical explanation).
- **Demos:** author runnable demo compositions for the new features
  (fonts, google-fonts, dynamic-props) and verify them in-browser. Media is a
  prose refresh — verify existing `video-sync`/`audio-mixer` demos still run.

## Nav structure (`packages/docs/content/docs/meta.json`)

```
Getting Started: introduction, installation, core-concepts, dynamic-props, best-practices
Animating:       interpolation, easing, sequencing
Drawing:         shapes, text, images
Layout:          flex, block
Fonts:           fonts, google-fonts            ← new section
Media:           video, audio
Transitions:     transitions-setup, transitions
Player:          player-setup, player
Rendering:       rendering-setup, rendering, rendering-media
```

## New pages + demos

Demos are drop-in files at `packages/docs/src/demos/<name>.ts` whose default
export is a `Composition` (auto-discovered — no registry). All demos run at
60fps, `loop: true`.

- **`fonts.mdx`** + `demos/fonts.ts` — the `Font` node, `seq.add(font)`,
  buffer-gated loading (no fallback-glyph flash), `Text`'s `font` prop,
  `font.face()` selection, browser vs server loaders (link to Rendering). Demo:
  a `Text` styled with a loaded custom font + a weight contrast.
- **`google-fonts.mdx`** + `demos/google-fonts.ts` — `@konva-motion/google-fonts`,
  per-family import, `{ weights, styles, subset }`, tree-shaking. Demo uses an
  already-generated family (roboto / playfair-display / jetbrains-mono /
  pacifico).
- **`dynamic-props.mdx`** + `demos/dynamic-props.ts` — `Composition({ props })`,
  `comp.props.get()` live in updaters, `comp.setProps(next | updater)`,
  `comp.refresh()`, `player.setProps()`. Demo: a props-parameterized composition
  with custom-control buttons calling `player.setProps()` to show live
  re-render (reuse the `player-custom-controls` pattern).

## Mediabunny prose fixes (no new demos)

- `rendering.mdx` — replace x264 CRF/preset quality table with mediabunny
  bitrate model; add WebM format.
- `rendering-media.mdx` — replace ffmpeg `amix` + "ffmpeg streaming decoder"
  with in-process Mediabunny decode/mix/encode; document remote font URLs +
  `fontCacheDir`.
- `audio.mdx` — fix render-path callout (in-process `mixAudio()` +
  `MediabunnyEncoder`); note video soundtracks now play.
- `video.mdx` — both paths use Mediabunny pull-based frame-accurate decode;
  soundtracks play.

## Dynamic-props threading (light edits, link back to canonical page)

- `core-concepts.mdx` — add `comp.props` signal + `refresh()` to the API
  surface and tick description.
- `introduction.mdx` — show props read **live** in an updater, not only at
  construction.
- `installation.mdx`, `interpolation.mdx`, `sequencing.mdx`,
  `best-practices.mdx` — one example/note each, linking to `dynamic-props`.
- `player.mdx` — add a concrete `setProps()` usage example.
- `text.mdx` — add `font` to the props list + link to the new Fonts page.

## Risks / notes

- **google-fonts demo dependency:** adding `@konva-motion/google-fonts` as a
  docs dep previously triggered RR7/Vite duplicate-React dedupe noise (known
  infra issue; app still renders via the error boundary). Verify; if it recurs,
  flag rather than chase it.
- **Verification:** docs is the React Router app — verify new demos in-browser.
  Mind the :5173/:5174 port pinning and per-layer canvas sampling noted in
  prior sessions (each `Sequence` is its own Konva layer/canvas).

## Work sequencing

1. **Mediabunny fixes** — factual, self-contained (`rendering`, `rendering-media`,
   `audio`, `video`).
2. **Dynamic props** — `dynamic-props.mdx` + demo + threading edits.
3. **Fonts + Google Fonts** — `fonts.mdx`, `google-fonts.mdx` + demos.
4. **Nav + cross-links + full in-browser verification** — `meta.json`, link
   pass, verify all new demos render.
