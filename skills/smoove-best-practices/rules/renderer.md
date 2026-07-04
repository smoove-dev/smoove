# Renderer — `@smoove/renderer`

Headless, Node-only video renderer. Walks the frame clock the same way the
player does, rasterizes each frame with skia-canvas, and encodes with
Mediabunny in one in-process pass — **no ffmpeg binary, no temp files.**

## Register the backend BEFORE building the composition

Import the `register` entry first. It installs the skia backend and Node-safe
media/font/image factories, and flips the composition into rendering mode:

```ts
import "@smoove/renderer/register"; // MUST be first
import { Composition, Rect, Sequence, interpolate } from "@smoove/core";
import { renderComposition } from "@smoove/renderer";

const comp = new Composition({ id: "out", fps: 60, durationInFrames: 120, width: 1280, height: 720 });
// ...build the scene...

await renderComposition(comp, { output: "out.mp4" });
```

Prefer the side-effect import. If you need options, call
`setupServerRendering({...})` (font cache dir, custom video factory) instead —
but still **before** constructing any `Composition`.

## `renderComposition(comp, options)`

Only `output` is required; everything else falls back to the composition's own
settings.

| Option | Meaning |
| --- | --- |
| `output` | Output file path (required). |
| `resolution` | `{ width, height }`; defaults to native size. |
| `fit` | `"contain"` (default) or `"cover"` when `resolution` differs in aspect. |
| `quality` | Preset `"low" \| "medium" \| "high" \| "max"`, or a `{ videoBitrate, audioBitrate }`. |
| `fps` | Output frame rate; defaults to `comp.fps`. |
| `range` | `{ from, to }` inclusive frame range. |
| `format` | `"mp4"` (default) or `"webm"`. |
| `mute` | Skip the audio track. |
| `fonts` | Fonts for `fontFamily`-only text; `Font` nodes need none (see gotchas). |
| `onProgress` | `({ frame, total, fps, etaSeconds }) => void`. |
| `signal` | `AbortSignal` to cancel. |

Related entry points: `renderStill` (one frame → PNG/JPEG buffer),
`renderToStream` (encode to a stream instead of a file), `renderFrames` (async
generator of raw RGBA frames). For WebGL shader transitions, also
`import "@smoove/renderer/gl"` before building the composition.

## Gotchas — fast fixes

- **"Composition is not in rendering mode" → register ran too late.** You built
  the `Composition` before importing `@smoove/renderer/register` (or calling
  `setupServerRendering()`). The register import must be the *first* line, above
  the core import. (Escape hatch: `new Composition({ mode: "rendering" })`.)
- **Fonts fall back / look wrong → check how the text picks its font.** skia
  can't read CSS `@font-face`. Text that uses a smoove `Font` node (including
  `@smoove/google-fonts` families) needs **zero render-side setup**: the node
  registers itself when added to the composition, and the server loader
  downloads + caches remote URLs to disk. Only text that picks a font purely
  by `fontFamily` (a raw `Konva.Text`, or a `Text` with no `font`) needs manual
  registration — pass `fonts` to `renderComposition` / `setupServerRendering`.
  Note skia's `FontLibrary` keys by **family name** and is first-wins per
  weight/style, so distinct fonts need distinct family names.
- **Font host needs auth / page preloads fonts → customize the loading, not
  the registration.** Subclass `Font` and override the protected
  `loadFace(face)` hook (branch on `detectEnvironment()`), or swap the whole
  loader with `setDefaultFontLoader` **after** `setupServerRendering()`. A
  query-string token on a face `src` rides through the default server loader
  untouched; header-based auth needs the swapped loader. See
  `/docs/typography/custom-fonts`.
- **"could not probe video" / media missing → asset URL, not an fs path.**
  Compositions import media as bundler URLs (`import clip from "./clip.mp4"` →
  `/src/...` in dev). The browser player streams that URL; skia/Mediabunny in
  Node can't. Fix at the bundler: `@smoove/vite` rewrites media/font imports to
  absolute filesystem paths in the SSR build only (configurable via
  `serverAssets`), so `new Video({ src: clip })` just works in both preview and
  render — no per-`src` helper. Rebuild `@smoove/vite` and restart dev after
  changing it.
- **Render disagrees with the preview → non-determinism.** `Date.now()`,
  `Math.random()`, `setInterval`, or anything not derived from `frame`/`props`
  looks fine in real-time playback but diverges frame-by-frame. Make the comp a
  pure function of the frame — see the **smoove-video** skill.
- **`skia-canvas` native build got skipped → cryptic render failure.** pnpm ≥10
  / bun block postinstall scripts of non-allow-listed deps, so the skia-canvas /
  node-av native builds silently don't run in a scaffolded app. Allow them
  (`pnpm.onlyBuiltDependencies` / `trustedDependencies` in the install root) and
  declare `skia-canvas` as an explicit dependency.
- **This is Node-only.** Don't import `@smoove/renderer` into browser/SPA route
  modules. In a studio app, run it behind a server endpoint — see
  [studio.md](studio.md).
