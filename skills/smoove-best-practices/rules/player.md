# Player — `<smoove-player>`

A framework-agnostic web component (Lit) that plays a `Composition` like an
HTML5 `<video>`: letterbox-scales to its box, and exposes a Remotion-style
imperative + event API. Works from plain HTML, React, Vue, Svelte, anything.

## Set it up

Import once to register the elements, then opt into the default styling
(the player is **headless** — no visible chrome — without it):

```ts
import "@smoove/player";            // registers <smoove-player> + controls
import "@smoove/player/styles.css"; // opt-in default styling
```

Give the element a size — it does not size itself to the composition:

```html
<smoove-player controls loop style="width: 640px; aspect-ratio: 16/9"></smoove-player>
```

## Hand it a composition (two ways)

**Imperatively — set the `composition` property.** It's an object, so it must
be a JS *property*, never an HTML attribute:

```ts
document.querySelector("smoove-player").composition = comp;
```

**Declaratively — point `src` at a module.** Like `<video src>`, the player
`import()`s the URL and resolves its default export (a `Composition`, or a
sync/async factory returning one, or `{ default: Composition }`):

```html
<smoove-player src="/orbit.js" controls loop></smoove-player>
```

`src` does a dynamic `import()`, which **executes arbitrary code** — only load
URLs you trust and allow the origin in your CSP `script-src`. An imperatively
assigned `composition` wins over `src`.

## Controls, API, events

- **Default controls:** add the `controls` attribute. To customize, nest
  `<smoove-player-controls>` / `<smoove-player-overlay>` children (light DOM,
  so restyle with plain selectors like `.smoove-player__btn`).
- **Attributes:** `src`, `controls`, `loop`, `autoplay`, `muted`, `volume`,
  `playbackrate`, `initialframe`, `max-pixel-ratio`, `no-click-to-play`,
  `no-space-key`, `no-keyboard`, `double-click-fullscreen`.
- **Methods:** `play`, `pause`, `toggle`, `stop`, `seekTo(frame)`,
  `stepBy(delta)`, `getCurrentFrame`, `isPlaying`, `setProps(props)`,
  volume/mute, loop, playback-rate, and fullscreen controls, `getScale`.
- **Events** (bubbling `CustomEvent`): `play`, `pause`, `ended`, `seeked`,
  `frameupdate`, `timeupdate` (throttled), `ratechange`, `volumechange`,
  `mutechange`, `fullscreenchange`, `scalechange`, `loadstart`, `loaded`,
  `error`. A `loading` attribute reflects while a `src` import is in flight.

Push new composition props live with `player.setProps({...})` — it re-renders
the current frame automatically.

## React usage

Set `composition` as a property via a ref (JSX attributes become HTML
attributes, which won't work for an object), and register the element on the
client only:

```tsx
import { useEffect, useRef } from "react";
import "@smoove/player";
import "@smoove/player/styles.css";
import comp from "./orbit"; // a Composition

export function Player() {
  const ref = useRef<HTMLElement & { composition?: unknown }>(null);
  useEffect(() => { if (ref.current) ref.current.composition = comp; }, []);
  return <smoove-player ref={ref} controls loop style={{ width: 640, aspectRatio: "16/9" }} />;
}
```

## No bundler? Use the CDN build

A self-contained ESM bundle registers every element and exposes
`window.Smoove` (it bundles Konva + the core authoring API, so author the comp
inline):

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@smoove/player/dist/player.global.js"></script>
```

Same file ships via the `@smoove/player/standalone` export and on unpkg. It is
ESM-only (`type="module"`), because core uses top-level await.

## Backdrop / background players

The player right-sizes its backing canvas to `displayed size × devicePixelRatio`
(capped at the device ratio), so a small player is cheap automatically. But a
**full-page backdrop** player (hero background, ambient loop behind content) at
retina density rasterizes millions of pixels per frame for a surface that is
dim, masked, or behind content — and a `max(100vw,100vh)` cover-square renders
mostly offscreen pixels on phones. Cap it:

```html
<smoove-player src="/bg.js" autoplay loop max-pixel-ratio="1"></smoove-player>
```

`max-pixel-ratio` bounds the effective pixel ratio (default: the device
ratio). `1` is indistinguishable on a dim backdrop and cuts paint work ~4× on
retina desktops, more on dpr-3 phones. Pair it with a comp authored for
backdrop duty — 30fps, no `shadowBlur` (see the **smoove-video** skill's
performance rule); the player can't fix a comp that blurs dozens of shapes
per frame. Also honor `prefers-reduced-motion` by calling `player.pause()`.

## Gotchas — fast fixes

- **Blank player, no console error → composition set as an attribute.** An
  object can't ride an HTML attribute. Set the `.composition` *property* (in
  React, via a ref). Verify in the page: `$0.composition` should be your comp,
  and `$0.composition.getChildren().length` should be > 0.
- **Intermittent blank on refresh under SSR/hydration → mount client-only.**
  The player injects its canvas chrome on `connectedCallback`; if it upgrades
  before React hydrates, hydration tears it down and recreates it over a
  cached (possibly stale) module. Gate every `<smoove-player>` behind a
  client-only wrapper (e.g. a `useHydrated`/`ClientOnly` that renders after
  hydration) so React never hydrates over it. This is why the player *pauses*
  (not destroys) on disconnect — a re-imported `export default comp` singleton
  must survive reconnect.
- **Player computes to 0×0 / paints off-screen → `styles.css` width cascade.**
  `player.css` sets `smoove-player { width: 100% }` and is injected *after*
  your page styles, so a bare `smoove-player { width: ... }` rule loses the
  cascade; inside a centering grid the `100%` goes cyclic → 0×0. Raise
  specificity (`body > smoove-player { ... }`) or set width inline.
- **Choppy playback on big/retina screens, or phone scroll jank → too many
  pixels or shadow blur.** Cap the player with `max-pixel-ratio="1"` for
  backdrop use (above), and audit the comp for `shadowBlur` on animated
  shapes — it profiles as the dominant per-frame cost; the smoove-video
  skill's performance rule has gradient-glow replacements.
- **`konva` is a peer dependency.** The consuming app pins the `konva` version;
  the player does not bundle it (except the standalone build). Mismatched or
  missing `konva` shows up as construction/render errors.
- **Plain Vite app throws on the composition module → `node:module` shim.**
  Core (via flexily) calls `createRequire` at module eval; Vite's browser stub
  makes it `undefined`. Alias `/^node:module$/` to a shim returning a lazily
  throwing `require`. The `create-smoove` templates ship this.
