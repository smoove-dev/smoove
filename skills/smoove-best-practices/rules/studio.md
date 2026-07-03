# Studio — `<Studio>`

A composable **React** studio UI: catalog sidebar, stage, timeline, props
panel, and render dialogs, assembled from a `<Studio>` compound component
around a `defineRegistry()` catalog. `<Studio.Stage>` renders through the same
`<smoove-player>` wiring, so everything in [player.md](player.md) still applies.

## Set it up

```sh
pnpm add konva react react-dom @smoove/core @smoove/player @smoove/studio
# optional — enables the render dialogs + queue:
pnpm add @smoove/renderer
```

`konva`, `react`, `react-dom`, `@smoove/core`, `@smoove/player` are peer deps;
`@smoove/renderer` is an **optional** peer.

## Declare a registry, compose the panels

```tsx
import { defineRegistry, Studio } from "@smoove/studio";
import "@smoove/studio/styles.css";
import orbit from "./compositions/orbit";
import pulse from "./compositions/pulse";

const registry = defineRegistry([pulse, orbit]);

export function App() {
  return (
    <Studio registry={registry} onNavigate={(id) => navigate(`/c/${id}`)}>
      <Studio.Sidebar>
        <Studio.Brand />
        <Studio.Library />
      </Studio.Sidebar>
      <Studio.Body>
        <Studio.Main>
          <Studio.Stage />
          <Studio.Timeline />
        </Studio.Main>
        <Studio.Panel>
          <Studio.SchemaForm />
        </Studio.Panel>
      </Studio.Body>
      <Studio.Toasts />
    </Studio>
  );
}
```

Each registry entry has an `id`, `title`, optional `group`/`description`/
`tags`, an optional `propsSchema`, and a **lazy** `composition` loader.
`<Studio.Library>` renders them as a grouped, searchable sidebar;
`<Studio.SchemaForm>` renders inputs for any comp with a `propsSchema`.

**The studio is configured by which components you render — there are no
feature flags.** To omit a region (say the zoom control), just don't render
`<Studio.Zoom>`. View switching (library / composition / queue) is your
router's job, not studio state; `<Studio>` tracks the selected id, and you sync
it from the route.

Build your own panels with the exported hooks (`useStudio`, `useComposition`,
`usePlayback`, `usePropsForm`, `useLayers`, …) — they read the same store.

## Hot reload with `@smoove/vite`

Pair with `@smoove/vite` for invisible composition HMR: editing a composition
file swaps it in-place, preserving props and playhead, with no full reload. The
registry exposes `update(id, load)` + `onChange(cb)`; the Vite plugin wires
`import.meta.hot` to call `registry.update(...)`.

## Rendering from the studio

The render dialogs (`<Studio.RenderDialog>`, `<Studio.ExportFrameDialog>`) and
`<Studio.RenderQueue>` need `@smoove/renderer`. Because the renderer is
Node-only, a browser SPA runs it **server-side**: the dialogs enqueue jobs
against your own endpoint (e.g. `/api/render*` with SSE progress) that calls
`renderComposition` — see [renderer.md](renderer.md).

## Gotchas — fast fixes

- **"Cannot read properties of null" (React is null) → dedupe React.** Studio
  (and its Base UI deps) must resolve a single React. In Vite set
  `resolve.dedupe: ["react", "react-dom"]`, and `optimizeDeps.include` the Base
  UI subpaths and `react-router` entries you use. (Clearing the `.vite` cache
  can throw a one-time cold-start error that auto-reloads past — harmless.)
- **Export dialogs do nothing → the optional renderer peer is missing.**
  `@smoove/renderer` isn't installed, or (in an SSR/SPA app) there's no server
  endpoint behind the dialog. Install it and wire the render route.
- **Import the styles.** `@smoove/studio/styles.css` is required; without it
  the UI is unstyled. Everything is scoped under `.smoove-studio`, and Preflight
  is intentionally omitted so it can't reset your host page.
- **Keep the player import client-only.** In an SSR/SPA app,
  `import "@smoove/player"` (it touches `customElements`) belongs only in
  `entry.client`. The studio package itself never side-effect-imports the
  player, so route modules that import `@smoove/studio` stay Node-safe and
  prerender cleanly. See [player.md](player.md) on client-only mounting.
